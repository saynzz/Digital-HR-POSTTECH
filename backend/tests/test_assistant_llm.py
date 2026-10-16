import httpx
import pytest

from app.models import Role
from app.services import assistant
from app.services.llm import OllamaClient


class FakeLLM:
    model = "fake"

    def __init__(self, reply=None, error=False):
        self.reply, self.error, self.calls = reply, error, []

    def chat(self, system, user):
        self.calls.append(user)
        if self.error:
            raise httpx.ConnectError("down")
        return self.reply

    def health(self):
        return {"status": "ready"}


@pytest.fixture
def use_llm(monkeypatch):
    def _set(fake):
        monkeypatch.setattr(assistant, "get_llm", lambda: fake)
        return fake
    return _set


def test_llm_answer_with_sources(use_llm):
    fake = use_llm(FakeLLM("Ежегодный отпуск — 24 календарных дня, остаток виден в кабинете."))
    r = assistant.ask("Сколько дней отпуска мне положено?", Role.employee)
    assert r.found and r.mode == "llm"
    assert r.sources[0].doc_id == "vacation"
    assert "Вопрос: Сколько дней отпуска" in fake.calls[0]


def test_llm_says_no_answer(use_llm):
    use_llm(FakeLLM("НЕТ_ОТВЕТА"))
    r = assistant.ask("Как оформить отпуск?", Role.employee)
    assert not r.found and r.mode == "refusal" and r.sources == []


def test_llm_not_called_without_context(use_llm):
    fake = use_llm(FakeLLM("что угодно"))
    r = assistant.ask("Какой курс биткоина завтра?", Role.employee)
    assert r.mode == "refusal" and fake.calls == []


def test_hallucinated_numbers_fallback_to_quote(use_llm):
    use_llm(FakeLLM("Отпуск составляет 45 дней."))
    r = assistant.ask("Сколько дней отпуска мне положено?", Role.employee)
    assert r.mode == "extractive" and "24" in r.answer


def test_llm_down_fallback_to_quote(use_llm):
    use_llm(FakeLLM(error=True))
    r = assistant.ask("Когда выплачивают аванс?", Role.employee)
    assert r.found and r.mode == "extractive"


def test_ollama_client_request_format(monkeypatch):
    sent = {}

    def fake_post(url, json, timeout):
        sent.update(url=url, body=json)
        return httpx.Response(200, json={"message": {"content": "ok"}}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    client = OllamaClient("http://ollama:11434/", "qwen2.5:3b", 10)
    assert client.chat("sys", "user") == "ok"
    assert sent["url"] == "http://ollama:11434/api/chat"
    assert sent["body"]["model"] == "qwen2.5:3b" and sent["body"]["stream"] is False
    assert sent["body"]["messages"][0] == {"role": "system", "content": "sys"}
