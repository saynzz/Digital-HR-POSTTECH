import argparse
import sys
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.integrations import zup_directory
from app.models import Role, User
from app.services import directory_sync as ds


def _print(run, plan) -> None:
    s = plan["summary"]
    print(f"Импорт №{run.id}: всего {s['total']}, новых {s['create']}, изменений {s['update']}, "
          f"увольнений {s['dismiss']}, без изменений {s['skip']}, ошибок {s['error']}, нет в источнике {s['missing']}")
    for it in plan["items"]:
        if it["errors"]:
            print(f"  строка {it['row']}: {it['full_name'] or it['external_id']} — {'; '.join(it['errors'])}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli", description="Загрузка сотрудников в Jana Hub")
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("import-employees", help="загрузить сотрудников из .xlsx или .csv")
    f.add_argument("file")
    z = sub.add_parser("sync-zup", help="синхронизировать сотрудников с 1С:ЗУП (ZUP_URL)")
    for x in (f, z):
        x.add_argument("--apply", action="store_true", help="применить изменения (без флага — только отчёт)")
        x.add_argument("--invite", action="store_true", help="отправить новым сотрудникам ссылки на почту")
        x.add_argument("--full-sync", action="store_true", help="показать сотрудников, которых нет в источнике")
        x.add_argument("--block-missing", action="store_true", help="заблокировать доступ тем, кого нет в источнике")
        x.add_argument("--actor", default=None, help="email HR, от имени которого идёт импорт")
    a = p.parse_args(argv)

    db = SessionLocal()
    try:
        actor = db.scalar(select(User).where(User.email == a.actor)) if a.actor else \
            db.scalar(select(User).where(User.role == Role.hr).order_by(User.id))
        if a.cmd == "import-employees":
            path = Path(a.file)
            records = ds.read_file(path.name, path.read_bytes())
            source, name = "file", path.name
        else:
            if not zup_directory.configured():
                print("ZUP_URL не задан: укажите адрес HTTP-сервиса или OData 1С:ЗУП в .env", file=sys.stderr)
                return 2
            records = ds.to_records(zup_directory.get_source().fetch())
            source, name = "1c_zup", None
        run = ds.create_run(db, actor, source, name, records, a.full_sync or a.block_missing)
        plan = ds.build_plan(db, [ds.Record(**{**r, "errors": list(r["errors"])}) for r in run.records],
                             run.summary["full_sync"])
        _print(run, plan)
        if a.apply:
            res = ds.apply_run(db, run, actor, a.invite, a.block_missing, True)
            print(f"Применено: создано {len(res['created'])}, обновлено {len(res['updated'])}, "
                  f"уволено {len(res['dismissed'])}, приглашений {len(res['invited'])}, "
                  f"заблокировано отсутствующих {len(res['blocked_missing'])}")
        else:
            print("Это предпросмотр. Добавьте --apply, чтобы применить.")
        return 0
    except ValueError as e:
        print(f"Ошибка: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
