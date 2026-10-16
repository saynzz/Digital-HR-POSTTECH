import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AccountStatus, AuditLog, Candidate, CandidateStatus, Employee, EnrollmentStatus, HRRequest, RequestStatus,
    RequestType, Role, User,
)
from app.schemas import AskOut, ReportOut, SourceOut
from app.services.analytics import (
    LEVEL_ORDER, LOCAL_TZ, MONTHS_SHORT, Facts, collect, days_word, fmt_date, fmt_money, gap_text, local_date, plural,
    scope_employees, short_name,
)
from app.services.llm import get_llm

log = logging.getLogger(__name__)

SRC_ZUP = SourceOut(doc_id="zup", title="1С:ЗУП", section="кадровые данные и остатки отпусков")
SRC_REQ = SourceOut(doc_id="requests", title="Заявки JanaMen", section="отпуска и авансы с историей решений")
SRC_ACADEMY = SourceOut(doc_id="academy", title="Jana Academy", section="назначенные курсы и результаты")
SRC_HR = SourceOut(doc_id="hr", title="HR-панель", section="кандидаты и учётные записи")
SRC_AUDIT = SourceOut(doc_id="audit", title="Журнал доступа", section="кто и когда смотрел данные сотрудников")

STATUS_TEXT = {
    RequestStatus.pending_manager: ("у руководителя", "warn"),
    RequestStatus.pending_hr: ("в HR", "warn"),
    RequestStatus.approved: ("оформлено", "good"),
    RequestStatus.rejected: ("отклонено", "bad"),
    RequestStatus.cancelled: ("отозвано", "muted"),
}


@dataclass
class Ctx:
    db: Session
    user: User
    arg: str
    facts: list[Facts]

    @property
    def is_hr(self) -> bool:
        return self.user.role == Role.hr

    @property
    def today(self) -> date:
        return self.facts[0].today if self.facts else date.today()

    @property
    def scope_label(self) -> str:
        return "по компании" if self.is_hr else "по вашей команде"


@dataclass
class Result:
    title: str
    subtitle: str | None
    blocks: list[dict]
    answer: str
    sources: list[SourceOut]
    suggestions: list[str]
    facts_for_ai: list[str] | None = None
    target_id: int | None = None


@dataclass
class Command:
    key: str
    aliases: tuple[str, ...]
    title: str
    hint: str
    roles: tuple[Role, ...]
    handler: Callable[[Ctx], Result | AskOut]
    arg: str | None = None


def stats(*items: tuple) -> dict:
    out = []
    for it in items:
        label, value, *rest = it
        out.append({"label": label, "value": str(value), "hint": rest[0] if rest else None,
                    "tone": rest[1] if len(rest) > 1 else None})
    return {"type": "stats", "items": out}


def cell(text, tone: str | None = None) -> dict:
    return {"text": str(text), "tone": tone}


def table(title: str | None, columns: list[str | tuple[str, str]], rows: list[dict], empty: str = "Нет данных") -> dict:
    cols = [{"label": c, "align": "left"} if isinstance(c, str) else {"label": c[0], "align": c[1]} for c in columns]
    return {"type": "table", "title": title, "columns": cols, "rows": rows, "empty": empty}


def row(*cells, cmd: str | None = None, link: str | None = None) -> dict:
    return {"cells": [c if isinstance(c, dict) else cell(c) for c in cells], "cmd": cmd, "link": link}


def bars(title: str, items: list[tuple], unit: str = "", empty: str = "Нет данных") -> dict:
    return {"type": "bars", "title": title, "unit": unit, "empty": empty, "items": [
        {"label": it[0], "value": it[1], "display": it[2] if len(it) > 2 else None,
         "tone": it[3] if len(it) > 3 else None, "cmd": it[4] if len(it) > 4 else None} for it in items]}


def signals_block(title: str, sigs, limit: int = 8, empty: str = "Сигналов нет — всё в порядке") -> dict:
    sigs = sorted(sigs, key=lambda s: LEVEL_ORDER[s.level])
    return {"type": "signals", "title": title, "items": [s.as_dict() for s in sigs[:limit]],
            "more": max(len(sigs) - limit, 0), "empty": empty}


def gap_tone(days: int) -> str | None:
    return "bad" if days > 365 else "warn" if days > 270 else None


def profile_cmd(f: Facts) -> str:
    return f"/сотрудник {f.name}"


NAME_WORD = re.compile(r"[а-яёәғқңөұүһі]+")


def _matches(word: str, name: str) -> bool:
    name = name.lower()
    if len(name) < 3:
        return False
    stem = name[:-1] if name[-1] in "аяыиоеуюь" else name
    return len(stem) >= 3 and word.startswith(stem) and len(word) <= len(name) + 3


def find_people(text: str, employees: list[Employee]) -> list[Employee]:
    words = [w for w in NAME_WORD.findall(text.lower()) if len(w) >= 3]
    hits = []
    for e in employees:
        parts = e.full_name.split()
        surname, first = parts[0], parts[1] if len(parts) > 1 else ""
        s_hit = any(_matches(w, surname) for w in words)
        f_hit = bool(first) and any(_matches(w, first) for w in words)
        if s_hit or f_hit:
            hits.append((2 if s_hit and f_hit else 1, e))
    if not hits:
        return []
    best = max(h[0] for h in hits)
    return [e for score, e in hits if score == best]


def _audit(db: Session, user: User, action: str, target: int | None = None, details: str | None = None) -> None:
    db.add(AuditLog(user_id=user.id, action=action, target_employee_id=target, details=details))
    db.commit()


def _text(answer: str, suggestions: list[str] | None = None) -> AskOut:
    return AskOut(answer=answer, sources=[], found=True, mode="analytics", suggestions=suggestions or [])


def cmd_profile(ctx: Ctx) -> Result | AskOut:
    if not ctx.arg.strip():
        names = [profile_cmd(f) for f in ctx.facts if f.emp.id != ctx.user.employee_id][:4]
        return _text("Укажите сотрудника: например, «/сотрудник Ахметов».", names)
    in_scope = find_people(ctx.arg, [f.emp for f in ctx.facts])
    if not in_scope:
        everyone = list(ctx.db.scalars(select(Employee)))
        outside = find_people(ctx.arg, everyone)
        if outside:
            _audit(ctx.db, ctx.user, "agent:denied", outside[0].id, ctx.arg[:200])
            return _text("Этого сотрудника нет в вашей команде. Руководитель видит аналитику только по своим "
                         "подчинённым, доступ к другим отделам есть у HR.")
        return _text(f"Не нашла сотрудника «{ctx.arg.strip()}» {ctx.scope_label}.",
                     [profile_cmd(f) for f in ctx.facts if f.emp.id != ctx.user.employee_id][:4])
    if len(in_scope) > 1:
        options = [f"/сотрудник {short_name(e.full_name)}" for e in in_scope]
        return _text("Нашла несколько сотрудников. Кого показать?", options)
    f = next(x for x in ctx.facts if x.emp.id == in_scope[0].id)
    return profile_report(f)


def cmd_self(ctx: Ctx) -> Result:
    f = collect(ctx.db, [ctx.user.employee])[0]
    res = profile_report(f, self_view=True)
    res.suggestions = []
    return res


def profile_report(f: Facts, self_view: bool = False) -> Result:
    e = f.emp
    today = f.today
    adv_all = f.advances()
    adv12 = f.advances_since(365)
    decision = f.decision_hours()
    blocks: list[dict] = [{
        "type": "person", "name": f.name, "full_name": e.full_name, "position": e.position,
        "department": e.department, "manager": short_name(e.manager.full_name) if e.manager else None,
        "hire_date": e.hire_date.isoformat(), "tenure": f.tenure, "account": f.account,
        "initials": "".join(p[0] for p in e.full_name.split()[:2]),
    }]
    gap = f.days_without_vac
    blocks.append(stats(
        ("Стаж", f.tenure, f"с {fmt_date(e.hire_date)}"),
        ("Остаток отпуска", days_word(f.balance), "по данным 1С:ЗУП", "warn" if f.balance >= 28 else None),
        ("Отгулено за всё время", days_word(f.taken_days), f"{len(f.vac_done)} {plural(len(f.vac_done), ('отпуск', 'отпуска', 'отпусков'))}"),
        ("Без отпуска", "в отпуске сейчас" if f.vac_now else gap_text(gap),
         f"последний закончился {fmt_date(f.last_vac_end)}" if f.last_vac_end and not f.vac_now else
         "с даты приёма" if not f.vac_now else None, gap_tone(gap)),
        ("Авансы за 12 мес.", f"{len(adv12)} на {fmt_money(sum(int(r.payload['amount']) for r in adv12))}",
         f"за всё время: {len(adv_all)} на {fmt_money(f.adv_total)}"),
        ("Обучение", f"{len(f.completed_courses)} из {len(f.enrollments)}",
         f"средний балл {f.avg_score}%" if f.avg_score is not None else "курсов пока нет" if not f.enrollments else None,
         "bad" if f.overdue_courses else None),
    ))
    by_year = f.vac_by_year()
    blocks.append(bars("Отпуск по годам", [
        (str(y), d, days_word(d), None) for y, d in by_year.items()], empty="Отпусков пока не было"))
    adv_year = f.adv_by_year()
    if any(adv_year.values()):
        blocks.append(bars("Авансы по годам", [(str(y), s, fmt_money(s) if s else "—") for y, s in adv_year.items()]))
    if not self_view:
        blocks.append(signals_block("На что обратить внимание", f.signals))

    events: list[dict] = [{"date": e.hire_date.isoformat(), "title": f.g("Принят на работу", "Принята на работу"),
                           "sub": f"{e.position}, {e.department}", "tone": "brand"}]
    for v in f.vacations:
        st, tone = STATUS_TEXT[v.status]
        label = "Отпуск" if v.end < today else "Отпуск сейчас" if v.start <= today else "Запланирован отпуск"
        events.append({"date": v.start.isoformat(), "title": f"{label}: {days_word(v.days)}",
                       "sub": f"{fmt_date(v.start)} – {fmt_date(v.end)} · {st}", "tone": tone, "link": f"/requests/{v.id}"})
    for r in f.advances(None):
        st, tone = STATUS_TEXT[r.status]
        events.append({"date": local_date(r.created_at).isoformat(), "title": f"Аванс {fmt_money(int(r.payload['amount']))}",
                       "sub": st, "tone": tone, "link": f"/requests/{r.id}"})
    for en in f.enrollments:
        if en.status == EnrollmentStatus.completed and en.completed_at:
            events.append({"date": local_date(en.completed_at).isoformat(), "title": f"Курс «{en.course.title}»",
                           "sub": f"пройден{f', {en.score}%' if en.score is not None else ''}", "tone": "good",
                           "link": f"/academy/{en.course_id}"})
        else:
            events.append({"date": local_date(en.assigned_at).isoformat(), "title": f"Назначен курс «{en.course.title}»",
                           "sub": f"прогресс {en.progress}%" + (f", срок {fmt_date(en.due_date)}" if en.due_date else ""),
                           "tone": "bad" if en in f.overdue_courses else "warn", "link": f"/academy/{en.course_id}"})
    events.sort(key=lambda x: x["date"], reverse=True)
    blocks.append({"type": "timeline", "title": "История с момента приёма", "items": events[:16],
                   "more": max(len(events) - 16, 0)})

    who = "Вы" if self_view else f.name
    parts = [f"{who} в компании {f.tenure} (с {fmt_date(e.hire_date)})."]
    if f.vac_now:
        parts.append(f"Сейчас в отпуске до {fmt_date(f.vac_now.end)}.")
    elif f.last_vac_end:
        parts.append(f"Последний отпуск закончился {fmt_date(f.last_vac_end)} — {gap_text(gap)} назад.")
    else:
        parts.append(f"В отпуске с момента приёма ещё не {f.g('был', 'была')}.")
    parts.append(f"Использовано {days_word(f.taken_days)} отпуска, в остатке {days_word(f.balance)}.")
    if f.vac_planned:
        v = f.vac_planned[0]
        parts.append(f"Запланирован отпуск с {fmt_date(v.start)} на {days_word(v.days)}.")
    if adv_all:
        parts.append(f"Авансов: {len(adv_all)} на {fmt_money(f.adv_total)}, из них за последний год — {len(adv12)}.")
    if not self_view:
        high = [s for s in f.signals if s.level == "high"]
        parts.append(f"Требует внимания: {len(high)}." if high else
                     "Критичных сигналов нет." if not f.signals else f"Сигналов к сведению: {len(f.signals)}.")

    ai = [f"Сотрудник: {f.name}, {e.position}", f"Стаж: {f.tenure}", f"Остаток отпуска: {f.balance} дн.",
          f"Без отпуска: {gap} дн.", f"Авансов за 12 месяцев: {len(adv12)}",
          f"Просроченных курсов: {len(f.overdue_courses)}"] + [f"Сигнал: {s.text}" for s in f.signals]
    if decision:
        ai.append(f"Среднее время оформления заявок: {round(sum(decision) / len(decision))} ч")
    return Result(f"Досье: {f.name}" if not self_view else "Моя статистика",
                  f"{e.position} · {e.department}", blocks, " ".join(parts),
                  [SRC_ZUP, SRC_REQ, SRC_ACADEMY], ["/отпуска", "/команда", "/риски"],
                  None if self_view else ai, e.id)


def _team_facts(ctx: Ctx) -> list[Facts]:
    return [f for f in ctx.facts if f.emp.id != ctx.user.employee_id or ctx.is_hr]


def cmd_team(ctx: Ctx) -> Result | AskOut:
    fs = _team_facts(ctx)
    if not fs:
        return _text("В вашей команде пока нет сотрудников.")
    now_off = [f for f in fs if f.vac_now]
    long_gap = [f for f in fs if f.days_without_vac > 365 and f.tenure_days >= 180]
    pending = [r for f in fs for r in f.pending]
    sigs = [s for f in fs for s in f.signals]
    high = [s for s in sigs if s.level == "high"]
    avg_tenure = sum(f.tenure_days for f in fs) / len(fs) / 365
    blocks = [stats(
        ("Сотрудников", len(fs), ctx.scope_label),
        ("Средний стаж", f"{avg_tenure:.1f}".replace(".", ",") + " г.", None),
        ("Сейчас в отпуске", len(now_off), ", ".join(f.name for f in now_off) or "никого"),
        ("Без отпуска > 12 мес.", len(long_gap), None, "bad" if long_gap else "good"),
        ("Заявки в работе", len(pending), "ждут решения" if pending else "очередь пуста", "warn" if pending else None),
        ("Важных сигналов", len(high), f"всего сигналов: {len(sigs)}", "bad" if high else "good"),
    )]
    rows = []
    for f in sorted(fs, key=lambda x: (min([LEVEL_ORDER[s.level] for s in x.signals] or [9]), x.emp.full_name)):
        top = f.signals[0] if f.signals else None
        rows.append(row(
            cell(f.name), f.emp.position if not ctx.is_hr else f.emp.department, f.tenure,
            cell(days_word(f.balance), "warn" if f.balance >= 28 else None),
            cell("в отпуске" if f.vac_now else gap_text(f.days_without_vac), gap_tone(f.days_without_vac)),
            str(len(f.advances_since(365))),
            cell(f"{len(f.completed_courses)}/{len(f.enrollments)}", "bad" if f.overdue_courses else None),
            cell(top.text if top else "в порядке", {"high": "bad", "medium": "warn", "info": None}[top.level] if top else "good"),
            cmd=profile_cmd(f)))
    blocks.append(table("Сотрудники", ["Сотрудник", "Отдел" if ctx.is_hr else "Должность", "Стаж", ("Остаток", "right"),
                                       ("Без отпуска", "right"), ("Авансы, 12 мес.", "right"), ("Курсы", "right"), "Главный сигнал"], rows))
    blocks.append(signals_block("Требует внимания", sigs, 6))
    blocks.append({"type": "export", "label": "Скачать отчёт (CSV для Excel)", "url": "/analytics/team.csv",
                   "filename": "janamen-team-report.csv"})
    answer = (f"{'В компании' if ctx.is_hr else 'В команде'} {len(fs)} {plural(len(fs), ('сотрудник', 'сотрудника', 'сотрудников'))}, "
              "средний стаж " + f"{avg_tenure:.1f}".replace(".", ",") + " г. " +
              (f"Сейчас в отпуске: {', '.join(f.name for f in now_off)}. " if now_off else "") +
              (f"Больше года без отпуска: {', '.join(f.name for f in long_gap)}. " if long_gap else "") +
              (f"В работе {len(pending)} {plural(len(pending), ('заявка', 'заявки', 'заявок'))}. " if pending else "") +
              (f"Важных сигналов: {len(high)}." if high else "Критичных сигналов нет."))
    ai = [f"Сотрудников: {len(fs)}", f"Сейчас в отпуске: {len(now_off)}", f"Без отпуска больше года: {len(long_gap)}",
          f"Заявок ждут решения: {len(pending)}"] + [f"Сигнал ({s.who}): {s.text}" for s in sorted(sigs, key=lambda s: LEVEL_ORDER[s.level])[:8]]
    return Result("Сводка " + ("по компании" if ctx.is_hr else "по команде"), f"на {fmt_date(ctx.today)}", blocks, answer,
                  [SRC_ZUP, SRC_REQ, SRC_ACADEMY], ["/отпуска", "/риски", "/авансы", "/обучение"], ai)


def _overlaps(fs: list[Facts], start: date, end: date) -> list[dict]:
    off: dict[date, list[str]] = {}
    for f in fs:
        for v in f.vacations:
            if v.status not in (RequestStatus.approved, RequestStatus.pending_manager, RequestStatus.pending_hr):
                continue
            d = max(v.start, start)
            while d <= min(v.end, end):
                off.setdefault(d, []).append(f.name)
                d += timedelta(days=1)
    out: list[dict] = []
    for d in sorted(off):
        names = sorted(set(off[d]))
        if len(names) < 2:
            continue
        if out and out[-1]["names"] == names and date.fromisoformat(out[-1]["end"]) + timedelta(days=1) == d:
            out[-1]["end"] = d.isoformat()
        else:
            out.append({"start": d.isoformat(), "end": d.isoformat(), "names": names})
    return out


def cmd_vacations(ctx: Ctx) -> Result | AskOut:
    fs = _team_facts(ctx)
    if not fs:
        return _text("В вашей команде пока нет сотрудников.")
    today = ctx.today
    start, end = today - timedelta(days=7), today + timedelta(days=90)
    rows = []
    for f in fs:
        vs = [v for v in f.vacations if v.status in (RequestStatus.approved, RequestStatus.pending_manager,
                                                      RequestStatus.pending_hr) and v.end >= start and v.start <= end]
        rows.append({"name": f.name, "cmd": profile_cmd(f), "bars": [
            {"start": v.start.isoformat(), "end": v.end.isoformat(),
             "status": "approved" if v.status == RequestStatus.approved else "pending",
             "label": days_word(v.days), "link": f"/requests/{v.id}"} for v in vs]})
    rows.sort(key=lambda r: (not r["bars"], r["bars"][0]["start"] if r["bars"] else "", r["name"]))
    overlaps = _overlaps(fs, today, end)
    planned = [f for f in fs if any(b for b in f.vacations if b.start > today and b.start <= end
                                    and b.status != RequestStatus.rejected and b.status != RequestStatus.cancelled)]
    long_gap = sorted([f for f in fs if f.tenure_days >= 180], key=lambda f: -f.days_without_vac)
    avg_balance = sum(f.balance for f in fs) / len(fs)
    blocks = [
        stats(("Сейчас в отпуске", len([f for f in fs if f.vac_now])),
              ("Уйдут в ближайшие 90 дней", len(planned), ", ".join(f.name for f in planned) or None),
              ("Средний остаток", days_word(round(avg_balance)), f"всего {days_word(sum(f.balance for f in fs))}"),
              ("Без отпуска > 12 мес.", len([f for f in long_gap if f.days_without_vac > 365]), None,
               "bad" if any(f.days_without_vac > 365 for f in long_gap) else "good"),
              ("Пересечения отпусков", len(overlaps), "в ближайшие 90 дней", "warn" if overlaps else "good")),
        {"type": "gantt", "title": "График отпусков: неделя назад и 90 дней вперёд", "start": start.isoformat(),
         "end": end.isoformat(), "today": today.isoformat(), "rows": rows, "overlaps": overlaps},
        bars("Дней без отпуска", [(f.name, f.days_without_vac, "в отпуске" if f.vac_now else gap_text(f.days_without_vac),
                                   gap_tone(f.days_without_vac), profile_cmd(f)) for f in long_gap[:10]]),
        bars("Остаток отпуска", [(f.name, f.balance, days_word(f.balance), "warn" if f.balance >= 28 else None, profile_cmd(f))
                                 for f in sorted(fs, key=lambda f: -f.balance)[:10]]),
        signals_block("Рекомендации по отпускам",
                      [s for f in fs for s in f.signals if s.code in ("no_vacation", "big_balance")]),
    ]
    parts = []
    if overlaps:
        o = overlaps[0]
        parts.append(f"Пересечение: {', '.join(o['names'])} одновременно отсутствуют "
                     f"{fmt_date(date.fromisoformat(o['start']))} – {fmt_date(date.fromisoformat(o['end']))}. "
                     "Проверьте, кто их заменит.")
    worst = [f for f in long_gap if f.days_without_vac > 365]
    if worst:
        parts.append("Больше года без отпуска: " + ", ".join(f"{f.name} ({gap_text(f.days_without_vac)})" for f in worst) + ".")
    if planned:
        parts.append(f"В ближайшие 90 дней в отпуск уходят: {', '.join(f.name for f in planned)}.")
    answer = " ".join(parts) or "Отпуска распределены равномерно, рисков не вижу."
    ai = [f"Пересечений отпусков: {len(overlaps)}", f"Средний остаток: {round(avg_balance)} дн."] + [
        f"{f.name}: без отпуска {f.days_without_vac} дн., остаток {f.balance} дн." for f in long_gap[:8]]
    return Result("Отпуска " + ctx.scope_label, f"на {fmt_date(today)}", blocks, answer,
                  [SRC_ZUP, SRC_REQ], ["/риски", "/команда"], ai)


def cmd_advances(ctx: Ctx) -> Result | AskOut:
    fs = _team_facts(ctx)
    if not fs:
        return _text("В вашей команде пока нет сотрудников.")
    today = ctx.today
    border = today - timedelta(days=365)
    all_adv = [(f, r) for f in fs for r in f.advances(None) if local_date(r.created_at) >= border]
    ok = [(f, r) for f, r in all_adv if r.status == RequestStatus.approved]
    total = sum(int(r.payload["amount"]) for _, r in ok)
    rejected = [x for x in all_adv if x[1].status == RequestStatus.rejected]
    months = []
    y, m = today.year, today.month
    for _ in range(12):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    months.reverse()
    by_month = {k: 0 for k in months}
    for _, r in ok:
        d = local_date(r.created_at)
        if (d.year, d.month) in by_month:
            by_month[(d.year, d.month)] += int(r.payload["amount"])
    by_emp: dict[int, tuple[Facts, int, int]] = {}
    for f, r in ok:
        _, s, c = by_emp.get(f.emp.id, (f, 0, 0))
        by_emp[f.emp.id] = (f, s + int(r.payload["amount"]), c + 1)
    blocks = [
        stats(("Выдано за 12 мес.", fmt_money(total)),
              ("Авансов", len(ok), f"у {len(by_emp)} {plural(len(by_emp), ('сотрудника', 'сотрудников', 'сотрудников'))}"),
              ("Средняя сумма", fmt_money(round(total / len(ok))) if ok else "—"),
              ("Отклонено", len(rejected), None, "warn" if rejected else None)),
        {**bars("По месяцам", [(f"{MONTHS_SHORT[m - 1]} {str(y)[2:]}", v, fmt_money(v) if v else "") for (y, m), v in by_month.items()]),
         "orientation": "vertical"},
        bars("По сотрудникам", [(f.name, s, f"{fmt_money(s)} · {c} шт.", "warn" if c >= 3 else None, profile_cmd(f))
                                for f, s, c in sorted(by_emp.values(), key=lambda x: -x[1])], empty="Авансов за год не было"),
        signals_block("Частые авансы", [s for f in fs for s in f.signals if s.code == "frequent_advances"],
                      empty="Частых авансов нет"),
        table("Последние заявки на аванс", ["Дата", "Сотрудник", ("Сумма", "right"), "Статус"], [
            row(fmt_date(local_date(r.created_at)), f.name, fmt_money(int(r.payload["amount"])),
                cell(*STATUS_TEXT[r.status]), link=f"/requests/{r.id}")
            for f, r in sorted(all_adv, key=lambda x: x[1].created_at, reverse=True)[:10]]),
    ]
    freq = [f for f in fs if len(f.advances_since(183)) >= 3]
    answer = (f"За последние 12 месяцев выдано {len(ok)} {plural(len(ok), ('аванс', 'аванса', 'авансов'))} "
              f"на {fmt_money(total)}" + (f", отклонено {len(rejected)}" if rejected else "") + ". " +
              (f"Часто берут авансы: {', '.join(f.name for f in freq)} — стоит деликатно уточнить, нужна ли поддержка."
               if freq else "Частых авансов нет."))
    return Result("Авансы " + ctx.scope_label, "последние 12 месяцев", blocks, answer, [SRC_REQ],
                  ["/команда", "/риски"])


def cmd_learning(ctx: Ctx) -> Result | AskOut:
    fs = _team_facts(ctx)
    items = [(f, e) for f in fs for e in f.enrollments]
    if not items:
        return _text("Курсы пока никому не назначены. Назначить курс можно в разделе «Команда».")
    done = [x for x in items if x[1].status == EnrollmentStatus.completed]
    overdue = [x for x in items if x[1] in x[0].overdue_courses]
    scores = [e.score for _, e in done if e.score is not None]
    status_text = {EnrollmentStatus.assigned: ("назначен", None), EnrollmentStatus.in_progress: ("в процессе", "warn"),
                   EnrollmentStatus.completed: ("пройден", "good"), EnrollmentStatus.failed: ("не сдан", "bad")}
    rows = []
    for f, e in sorted(items, key=lambda x: (x[1].status == EnrollmentStatus.completed, x[1].due_date or date.max)):
        st, tone = status_text[e.status]
        if e in f.overdue_courses:
            st, tone = f"просрочен на {days_word((ctx.today - e.due_date).days)}", "bad"
        rows.append(row(f.name, e.course.title, cell(f"{e.progress}%"),
                        fmt_date(e.due_date) if e.due_date else "—",
                        f"{e.score}%" if e.score is not None else "—", cell(st, tone), cmd=profile_cmd(f)))
    blocks = [
        stats(("Назначено", len(items)), ("Пройдено", len(done), None, "good"),
              ("В процессе", len(items) - len(done) - len(overdue)),
              ("Просрочено", len(overdue), None, "bad" if overdue else "good"),
              ("Средний балл", f"{round(sum(scores) / len(scores))}%" if scores else "—")),
        table("Курсы сотрудников", ["Сотрудник", "Курс", ("Прогресс", "right"), "Срок", ("Балл", "right"), "Статус"], rows),
        signals_block("Просроченные курсы", [s for f in fs for s in f.signals if s.code == "overdue_course"],
                      empty="Просроченных курсов нет"),
    ]
    answer = (f"Назначено {len(items)} {plural(len(items), ('курс', 'курса', 'курсов'))}, пройдено {len(done)}"
              + (f", средний балл {round(sum(scores) / len(scores))}%" if scores else "") + ". "
              + (f"Просрочены: {', '.join(f'{f.name} — «{e.course.title}»' for f, e in overdue)}." if overdue
                 else "Просроченных нет."))
    return Result("Обучение " + ctx.scope_label, "Jana Academy", blocks, answer, [SRC_ACADEMY], ["/команда", "/риски"])


def cmd_queue(ctx: Ctx) -> Result | AskOut:
    status = RequestStatus.pending_hr if ctx.is_hr else RequestStatus.pending_manager
    reqs = [(f, r) for f in ctx.facts for r in f.pending if r.status == status]
    if not ctx.is_hr:
        reqs = [(f, r) for f, r in reqs if f.emp.manager_id == ctx.user.employee_id]
    if not reqs:
        return _text("Заявок, которые ждут вашего решения, нет. Очередь пуста.", ["/команда", "/отпуска"])
    reqs.sort(key=lambda x: x[1].created_at)
    rows = []
    for f, r in reqs:
        w = f.waiting_days(r)
        what = (f"{fmt_date(date.fromisoformat(r.payload['start_date']))} – {fmt_date(date.fromisoformat(r.payload['end_date']))}, "
                f"{days_word(int(r.payload.get('days', 0)))}" if r.type == RequestType.vacation else fmt_money(int(r.payload["amount"])))
        rows.append(row(f"№{r.id}", f.name, "Отпуск" if r.type == RequestType.vacation else "Аванс", what,
                        cell(days_word(w) if w else "сегодня", "bad" if w >= 5 else "warn" if w >= 3 else None),
                        link=f"/requests/{r.id}"))
    oldest = max(f.waiting_days(r) for f, r in reqs)
    hint = []
    for f, r in reqs:
        if r.type == RequestType.vacation:
            s, e = date.fromisoformat(r.payload["start_date"]), date.fromisoformat(r.payload["end_date"])
            others = [o.name for o in ctx.facts if o.emp.id != f.emp.id and any(
                v.status == RequestStatus.approved and v.start <= e and v.end >= s for v in o.vacations)]
            if others:
                hint.append(f"№{r.id}: в эти даты уже отдыхает {', '.join(others)}")
            hint.append(f"№{r.id}: после отпуска у {f.name} останется {days_word(f.balance - int(r.payload.get('days', 0)))}")
        else:
            n = len(f.advances_since(183))
            if n:
                hint.append(f"№{r.id}: у {f.name} уже {n} {plural(n, ('аванс', 'аванса', 'авансов'))} за полгода")
    blocks = [
        stats(("Ждут решения", len(reqs)), ("Самая давняя", days_word(oldest) if oldest else "сегодня", None,
                                            "bad" if oldest >= 5 else "warn" if oldest >= 3 else None)),
        table(None, ["№", "Сотрудник", "Тип", "Детали", ("Ждёт", "right")], rows),
    ]
    if hint:
        blocks.append({"type": "notes", "title": "Подсказки для решения", "items": hint})
    answer = (f"Ждут {'оформления' if ctx.is_hr else 'вашего решения'}: {len(reqs)} "
              f"{plural(len(reqs), ('заявка', 'заявки', 'заявок'))}. "
              + (f"Самая давняя ждёт {days_word(oldest)}." if oldest else "Все поступили сегодня."))
    return Result("Очередь заявок", "оформление в HR" if ctx.is_hr else "согласование руководителем", blocks,
                  answer, [SRC_REQ], ["/отпуска", "/команда"])


def cmd_risks(ctx: Ctx) -> Result | AskOut:
    fs = _team_facts(ctx)
    sigs = [s for f in fs for s in f.signals]
    by = {lvl: [s for s in sigs if s.level == lvl] for lvl in ("high", "medium", "info")}
    blocks = [
        stats(("Важные", len(by["high"]), None, "bad" if by["high"] else "good"),
              ("Средние", len(by["medium"]), None, "warn" if by["medium"] else None),
              ("К сведению", len(by["info"])),
              ("Сотрудников с сигналами", len({s.employee_id for s in sigs}), f"из {len(fs)}")),
        signals_block("Все сигналы", sigs, 20),
    ]
    answer = ("Сигналов нет — команда в порядке." if not sigs else
              f"Найдено сигналов: {len(sigs)}, из них важных — {len(by['high'])}. " +
              ("Начните с: " + "; ".join(f"{s.who} — {s.text.lower()}" for s in by["high"][:3]) + "." if by["high"] else ""))
    ai = [f"{s.who}: {s.text}" for s in sorted(sigs, key=lambda s: LEVEL_ORDER[s.level])[:12]]
    return Result("Риски и сигналы", ctx.scope_label, blocks, answer, [SRC_ZUP, SRC_REQ, SRC_ACADEMY],
                  ["/отпуска", "/авансы", "/обучение"], ai if sigs else None)


def cmd_departments(ctx: Ctx) -> Result:
    groups: dict[str, list[Facts]] = {}
    for f in ctx.facts:
        groups.setdefault(f.emp.department, []).append(f)
    rows, heads = [], []
    for dep, fs in sorted(groups.items(), key=lambda x: -len(x[1])):
        n = len(fs)
        vac12 = sum(v.days for f in fs for v in f.vac_done if v.end >= ctx.today - timedelta(days=365))
        adv = [r for f in fs for r in f.advances_since(365)]
        high = sum(1 for f in fs for s in f.signals if s.level == "high")
        rows.append(row(dep, str(n), f"{sum(f.tenure_days for f in fs) / n / 365:.1f}".replace(".", ",") + " г.",
                        days_word(round(sum(f.balance for f in fs) / n)), days_word(vac12),
                        f"{len(adv)} · {fmt_money(sum(int(r.payload['amount']) for r in adv))}" if adv else "—",
                        cell(str(sum(len(f.overdue_courses) for f in fs)), "bad" if any(f.overdue_courses for f in fs) else None),
                        cell(str(high), "bad" if high else "good")))
        heads.append((dep, n, f"{n} чел."))
    blocks = [
        stats(("Отделов", len(groups)), ("Сотрудников", len(ctx.facts)),
              ("Средний остаток отпуска", days_word(round(sum(f.balance for f in ctx.facts) / max(len(ctx.facts), 1))))),
        bars("Численность", heads),
        table("Сравнение отделов", ["Отдел", ("Людей", "right"), ("Стаж", "right"), ("Ср. остаток", "right"),
                                    ("Отпуск за 12 мес.", "right"), ("Авансы за 12 мес.", "right"),
                                    ("Просрочки", "right"), ("Важные сигналы", "right")], rows),
    ]
    return Result("Отделы компании", f"на {fmt_date(ctx.today)}", blocks,
                  f"В компании {len(groups)} {plural(len(groups), ('отдел', 'отдела', 'отделов'))} и {len(ctx.facts)} "
                  f"{plural(len(ctx.facts), ('сотрудник', 'сотрудника', 'сотрудников'))}. Сравнение по отпускам, авансам и обучению ниже.",
                  [SRC_ZUP, SRC_REQ, SRC_ACADEMY], ["/команда", "/риски"])


def cmd_onboarding(ctx: Ctx) -> Result:
    db, today = ctx.db, ctx.today
    cands = list(db.scalars(select(Candidate).where(Candidate.status != CandidateStatus.archived)))
    cnt = {s: sum(1 for c in cands if c.status == s) for s in CandidateStatus}
    newbies = sorted([f for f in ctx.facts if f.tenure_days <= 90], key=lambda f: f.emp.hire_date, reverse=True)
    invited = [f for f in ctx.facts if f.user and f.user.status == AccountStatus.invited]
    rows = []
    for f in newbies:
        intro = f.enrollments[0] if f.enrollments else None
        rows.append(row(f.name, f.emp.position, fmt_date(f.emp.hire_date), days_word(f.tenure_days),
                        cell(f.account, "warn" if f.account != "активен" else "good"),
                        cell(f"{intro.progress}%" if intro else "не назначен",
                             "bad" if intro and intro in f.overdue_courses else None if intro else "warn"),
                        cmd=profile_cmd(f)))
    upcoming = sorted([c for c in cands if c.status == CandidateStatus.interview_pending and c.interview_at],
                      key=lambda c: c.interview_at)
    blocks = [
        stats(("Ждут собеседования", cnt[CandidateStatus.interview_pending]),
              ("Прошли, ждут оформления", cnt[CandidateStatus.interview_passed], None,
               "warn" if cnt[CandidateStatus.interview_passed] else None),
              ("Новички до 90 дней", len(newbies)),
              ("Не активировали доступ", len(invited), None, "warn" if invited else "good")),
        table("Новички: первые 90 дней", ["Сотрудник", "Должность", "Дата выхода", ("В компании", "right"),
                                          "Доступ", ("Вводный курс", "right")], rows, "Новичков за 90 дней нет"),
        table("Ближайшие собеседования", ["Кандидат", "Должность", "Отдел", "Когда"], [
            row(c.full_name, c.position, c.department, fmt_date(local_date(c.interview_at)), link="/hr") for c in upcoming],
            "Собеседований не запланировано"),
        signals_block("Что сделать", [s for f in ctx.facts for s in f.signals if s.code in ("onboarding", "not_activated")]),
    ]
    answer = (f"Кандидатов в работе: {cnt[CandidateStatus.interview_pending] + cnt[CandidateStatus.interview_passed]}, "
              f"из них ждут оформления после успешного собеседования — {cnt[CandidateStatus.interview_passed]}. "
              f"Новичков за 90 дней: {len(newbies)}"
              + (f", не активировали доступ: {', '.join(f.name for f in invited)}." if invited else "."))
    return Result("Найм и адаптация", "кандидаты и первые 90 дней", blocks, answer, [SRC_HR, SRC_ZUP, SRC_ACADEMY],
                  ["/команда", "/риски"])


AUDIT_KEYS = {"сотрудник": "profile", "команда": "team", "отпуска": "vacations", "авансы": "advances",
              "обучение": "learning", "ждут": "queue", "риски": "risks", "отделы": "departments", "найм": "onboarding",
              "журнал": "journal"}
ACTION_TEXT = {"agent:profile": "досье сотрудника", "agent:team": "сводка по команде", "agent:vacations": "отпуска",
               "agent:advances": "авансы", "agent:learning": "обучение", "agent:risks": "риски",
               "agent:departments": "отделы", "agent:onboarding": "найм и адаптация", "agent:queue": "очередь заявок",
               "agent:denied": "отказ: нет доступа", "export:team_csv": "выгрузка отчёта CSV", "agent:journal": "журнал"}


def cmd_journal(ctx: Ctx) -> Result:
    items = list(ctx.db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(30)))
    rows = [row(a.created_at.astimezone(LOCAL_TZ).strftime("%d.%m.%Y %H:%M"),
                short_name(a.user.employee.full_name) if a.user and a.user.employee else "—",
                cell(ACTION_TEXT.get(a.action, a.action), "bad" if a.action == "agent:denied" else None),
                short_name(a.target.full_name) if a.target else "—") for a in items]
    return Result("Журнал доступа к данным", "последние 30 действий", [
        table(None, ["Когда", "Кто", "Действие", "Чьи данные"], rows, "Записей пока нет")],
        "Каждый просмотр аналитики и выгрузка записываются в журнал: видно, кто и когда смотрел данные сотрудников.",
        [SRC_AUDIT], ["/команда"])


def cmd_help(ctx: Ctx) -> AskOut:
    items = [{"cmd": f"/{c.key}" + (f" {c.arg}" if c.arg else ""), "run": f"/{c.key}" if not c.arg else None,
              "title": c.title, "hint": c.hint} for c in COMMANDS if ctx.user.role in c.roles and c.key != "помощь"]
    intro = ("Я считаю аналитику по данным 1С:ЗУП, заявкам и Jana Academy — только по сотрудникам, к которым у вас "
             "есть доступ. Команды можно писать и обычным текстом: «кто давно не был в отпуске?», «покажи Ахметова»."
             if ctx.user.role != Role.employee else
             "Аналитика по сотрудникам доступна руководителям и HR. Вам доступна личная статистика.")
    return AskOut(answer=intro, sources=[], found=True, mode="analytics",
                  report=ReportOut(title="Команды AI Jana", subtitle=None, blocks=[{"type": "commands", "items": items}]))


MGR = (Role.manager, Role.hr)
COMMANDS: list[Command] = [
    Command("команда", ("сводка", "team"), "Сводка по команде", "стаж, отпуска, авансы, обучение и сигналы по каждому", MGR, cmd_team),
    Command("сотрудник", ("досье", "профиль", "employee"), "Досье сотрудника", "вся история с даты приёма по сегодня", MGR, cmd_profile, "Фамилия"),
    Command("отпуска", ("график", "vacations"), "Отпуска", "график на 90 дней, пересечения, кто давно не отдыхал", MGR, cmd_vacations),
    Command("авансы", ("advances",), "Авансы", "суммы за 12 месяцев, по месяцам и по людям", MGR, cmd_advances),
    Command("обучение", ("курсы", "learning"), "Обучение", "прогресс, баллы и просрочки по курсам", MGR, cmd_learning),
    Command("ждут", ("очередь", "queue"), "Очередь заявок", "что ждёт вашего решения и подсказки", MGR, cmd_queue),
    Command("риски", ("сигналы", "risks"), "Риски", "все сигналы и рекомендации, начиная с важных", MGR, cmd_risks),
    Command("отделы", ("departments",), "Отделы", "сравнение отделов компании", (Role.hr,), cmd_departments),
    Command("найм", ("новички", "адаптация", "onboarding"), "Найм и адаптация", "кандидаты, новички, неактивированные доступы", (Role.hr,), cmd_onboarding),
    Command("журнал", ("аудит", "audit"), "Журнал доступа", "кто и когда смотрел данные сотрудников", (Role.hr,), cmd_journal),
    Command("я", ("моя", "me"), "Моя статистика", "мой стаж, отпуска, авансы и обучение", (Role.employee, Role.manager, Role.hr), cmd_self),
    Command("помощь", ("команды", "help"), "Все команды", "", (Role.employee, Role.manager, Role.hr), cmd_help),
]

TEAM_WORDS = r"(команд|подчин|сотрудников|коллектив|отдел|\bкто\b|у кого|у всех|наш)"
INTENTS: list[tuple[str, str]] = [
    ("помощь", r"(что ты умеешь|какие (есть )?команды|список команд)"),
    ("журнал", r"(журнал доступа|кто смотрел|аудит)"),
    ("найм", r"(новичк|онбординг|адаптаци|кандидат|собеседован)"),
    ("отделы", r"(по отделам|сравни\w* отдел|отделы компании)"),
    ("ждут", r"(ждут (моего )?(решени|согласован|оформлен)|очеред\w* заяв|что (мне )?(нужно )?согласовать)"),
    ("риски", r"(риск|сигнал|выгоран|на что обратить)"),
    ("отпуска", r"(график\w* отпуск|без отпуска|давно не (был|отдыха|ходил)|пересечени|"
                rf"отпуск\w*.*{TEAM_WORDS}|{TEAM_WORDS}.*отпуск)"),
    ("авансы", rf"(аванс\w*.*{TEAM_WORDS}|{TEAM_WORDS}.*аванс)"),
    ("обучение", rf"(просроч\w* курс|(курс|обучени)\w*.*{TEAM_WORDS}|{TEAM_WORDS}.*(курс|обучени))"),
    ("команда", r"(сводк|аналитик|отч[её]т по|как дела в команд|моя команда|по команде|обзор команд)"),
]
PROFILE_HINT = r"(досье|покажи|расскажи|данные|истори|статистик|аналитик|профиль|как (дела|там)|что с|сколько|отпуск|аванс|курс|стаж)"


def _find_command(word: str) -> Command | None:
    word = word.lower()
    return next((c for c in COMMANDS if word == c.key or word in c.aliases), None)


def route(text: str, user: User, people: list[Employee]) -> tuple[Command, str] | None:
    t = text.strip()
    if t.startswith("/"):
        head, _, rest = t[1:].partition(" ")
        cmd = _find_command(head)
        if cmd is None:
            return _find_command("помощь"), ""
        return cmd, rest
    low = t.lower()
    if re.search(r"(моя статистика|мои показатели|мой стаж)", low):
        return _find_command("я"), ""
    if user.role == Role.employee:
        return None
    if re.search(PROFILE_HINT, low):
        others = [p for p in people if p.id != user.employee_id]
        if find_people(t, others):
            return _find_command("сотрудник"), t
    for key, pattern in INTENTS:
        if re.search(pattern, low):
            cmd = _find_command(key)
            if cmd and user.role in cmd.roles:
                return cmd, ""
    return None


AI_PROMPT = """Ты — AI Jana, помощник руководителя и HR в компании Jana Post.
Тебе дают факты, посчитанные системой по данным 1С:ЗУП, заявок и обучения.
Сформулируй 2–3 коротких практических рекомендации (каждая с новой строки, начиная с «— »).
Правила:
- Используй только приведённые факты, не придумывай чисел, дат и причин.
- Не ставь диагнозов и не делай выводов о личной жизни сотрудника.
- Не принимай кадровых решений — только предлагай действия руководителю.
- Пиши по-русски, без вступления и без заключения."""


def _insight(facts: list[str]) -> str | None:
    llm = get_llm()
    if llm is None or not facts:
        return None
    text = "\n".join(facts)
    try:
        out = llm.chat(AI_PROMPT, f"Факты:\n{text}").strip()
    except Exception:
        log.warning("LLM недоступна для вывода по аналитике", exc_info=True)
        return None
    if not out or not set(re.findall(r"\d+", out)) <= set(re.findall(r"\d+", text)):
        return None
    return out


def handle(db: Session, user: User, text: str) -> AskOut | None:
    people = scope_employees(db, user)
    if user.role == Role.employee and not text.strip().startswith("/") and re.search(PROFILE_HINT, text.lower()):
        others = [e for e in db.scalars(select(Employee)) if e.id != user.employee_id]
        if find_people(text, others):
            return AskOut(answer="Я не показываю данные других сотрудников. Свою статистику можно посмотреть командой «/я».",
                          sources=[], found=True, mode="refusal", suggestions=["/я"])
    routed = route(text, user, people)
    if routed is None:
        return None
    cmd, arg = routed
    if user.role not in cmd.roles:
        if user.role == Role.employee:
            return _text("Аналитика по сотрудникам доступна руководителям и HR. Вам доступны «/я» и вопросы по базе знаний.",
                         ["/я", "/помощь"])
        return _text("Эта команда доступна только HR.", ["/помощь"])
    if cmd.key == "помощь":
        return cmd_help(Ctx(db, user, arg, []))
    facts = collect(db, people) if cmd.key != "я" else []
    res = cmd.handler(Ctx(db, user, arg, facts))
    if isinstance(res, AskOut):
        return res
    if cmd.key != "я":
        _audit(db, user, f"agent:{AUDIT_KEYS.get(cmd.key, cmd.key)}", res.target_id)
    insight = _insight(res.facts_for_ai) if res.facts_for_ai else None
    return AskOut(answer=res.answer, sources=res.sources, found=True, mode="analytics",
                  report=ReportOut(title=res.title, subtitle=res.subtitle, blocks=res.blocks),
                  insight=insight, suggestions=res.suggestions)


def commands_for(user: User) -> list[dict]:
    return [{"cmd": f"/{c.key}", "title": c.title, "hint": c.hint, "arg": c.arg} for c in COMMANDS if user.role in c.roles]
