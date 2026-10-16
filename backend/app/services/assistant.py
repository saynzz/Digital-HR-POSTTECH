import logging
import math
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.models import Role
from app.schemas import AskOut, SourceOut
from app.services.llm import get_llm

log = logging.getLogger(__name__)

KB_DIR = Path(__file__).resolve().parents[2] / "knowledge_base"

STOPWORDS = {
    "как", "что", "где", "когда", "мне", "мой", "моя", "мои", "это", "для", "или", "если", "при", "про",
    "можно", "нужно", "надо", "ли", "на", "в", "и", "с", "по", "о", "у", "к", "за", "из", "до", "не", "а",
    "какой", "какая", "какие", "сколько", "есть", "быть", "я", "меня", "чтобы", "ещё", "еще", "так",
    "взять", "брать", "получить", "хочу", "могу", "делать", "сделать", "узнать", "работать",
}

PRIVATE_PATTERNS = [r"зарплат\w*\s+(у\s+)?[А-ЯЁ]", r"оклад\w*\s+(у\s+)?[А-ЯЁ]", r"(телефон|адрес|иин)\s+[А-ЯЁ]"]

REFUSAL = (
    "В базе знаний нет надёжного ответа на этот вопрос. "
    "Я не буду угадывать — предлагаю передать вопрос специалисту HR."
)


@dataclass
class Section:
    doc_id: str
    title: str
    section: str | None
    text: str
    source: str | None
    roles: set[str]
    tokens: set[str] = field(default_factory=set)


def normalize(text: str) -> set[str]:
    words = re.findall(r"[a-zа-яёәғқңөұүһі0-9]+", text.lower())
    return {w[:5] for w in words if len(w) > 2 and w not in STOPWORDS}


def _parse(path: Path) -> list[Section]:
    raw = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    if raw.startswith("---"):
        _, fm, raw = raw.split("---", 2)
        for line in fm.strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    title = meta.get("title", path.stem)
    roles = {r.strip() for r in meta.get("roles", "employee,manager,hr").split(",")}
    keywords = meta.get("keywords", "")
    sections: list[Section] = []
    for chunk in re.split(r"\n(?=## )", raw.strip()):
        heading = None
        if chunk.startswith("## "):
            heading, _, chunk = chunk.partition("\n")
            heading = heading[3:].strip()
        body = chunk.strip()
        if not body or body.startswith("# "):
            body = re.sub(r"^# .*\n?", "", body).strip()
        if body:
            s = Section(path.stem, title, heading, body, meta.get("source"), roles)
            s.tokens = normalize(f"{title} {heading or ''} {body} {keywords}")
            sections.append(s)
    return sections


@lru_cache
def load_kb() -> tuple[list[Section], dict[str, float], float]:
    sections: list[Section] = []
    for p in sorted(KB_DIR.glob("*.md")):
        sections.extend(_parse(p))
    n = len(sections)
    df: dict[str, int] = {}
    for s in sections:
        for t in s.tokens:
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}
    unknown_idf = math.log(n + 1) + 1
    return sections, idf, unknown_idf


def retrieve(question: str, role: Role, k: int = 3) -> list[tuple[Section, float]]:
    q = normalize(question)
    if not q:
        return []
    sections, idf, unknown_idf = load_kb()
    weights = {t: idf.get(t, unknown_idf) for t in q}
    total = sum(weights.values())
    scored = []
    for s in sections:
        if role.value not in s.roles:
            continue
        score = sum(w for t, w in weights.items() if t in s.tokens) / total
        if score >= settings.assistant_min_score:
            scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:k]


SYSTEM_PROMPT = """Ты — AI Jana, HR-ассистент компании Jana Post.
Правила:
- Отвечай ТОЛЬКО на основе фрагментов базы знаний из сообщения пользователя.
- Не добавляй фактов, сроков, сумм и правил, которых нет во фрагментах.
- Если во фрагментах нет ответа на вопрос, ответь ровно одним словом: НЕТ_ОТВЕТА
- Отвечай кратко (2–4 предложения), на языке вопроса (русский или казахский).
- Не обсуждай персональные данные других сотрудников и не принимай кадровых решений.
- Не перечисляй источники в конце — их покажет интерфейс."""

NO_ANSWER_MARK = "НЕТ_ОТВЕТА"


def _numbers(text: str) -> set[str]:
    return set(re.findall(r"\d+", text))


def _generate(question: str, context: list[Section]) -> str | None:
    llm = get_llm()
    if llm is None:
        return None
    blocks = "\n\n".join(
        f"[{i}] {s.title}{' — ' + s.section if s.section else ''}\n{s.text}" for i, s in enumerate(context, 1))
    try:
        answer = llm.chat(SYSTEM_PROMPT, f"Фрагменты базы знаний:\n\n{blocks}\n\nВопрос: {question}").strip()
    except Exception:
        log.warning("LLM недоступна, отвечаю цитатой из базы знаний", exc_info=True)
        return None
    if not answer:
        return None
    if NO_ANSWER_MARK in answer:
        return NO_ANSWER_MARK
    if not _numbers(answer) <= _numbers(blocks):
        log.warning("LLM добавила числа, которых нет в контексте: %s", answer)
        return None
    return answer


def ask(question: str, role: Role) -> AskOut:
    if any(re.search(p, question) for p in PRIVATE_PATTERNS):
        return AskOut(answer="Я не предоставляю персональные данные других сотрудников.",
                      sources=[], found=False, mode="refusal")

    hits = retrieve(question, role)
    if not hits:
        return AskOut(answer=REFUSAL, sources=[], found=False, mode="refusal")

    context = [s for s, _ in hits]
    generated = _generate(question, context)
    if generated == NO_ANSWER_MARK:
        return AskOut(answer=REFUSAL, sources=[], found=False, mode="refusal")

    sources = [SourceOut(doc_id=s.doc_id, title=s.title, section=s.section, url=s.source) for s in context]
    if generated:
        return AskOut(answer=generated, sources=sources, found=True, mode="llm")
    best = context[0]
    return AskOut(answer=best.text, sources=sources[:1], found=True, mode="extractive")
