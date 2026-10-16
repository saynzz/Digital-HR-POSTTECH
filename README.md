# JanaMen — единая HR-платформа сотрудника

Jana Post × Terricon Valley Hackathon 2026 · **Challenge 02 / Digital HR**

Один вход, а в нём профиль, HR-заявки, обучение (Jana Academy), AI-ассистент (AI Jana) и уведомления.

## Быстрый старт (Docker)

Нужен Docker Desktop. Для локальной модели выделите ему **не меньше 6 ГБ RAM**: Settings → Resources.

```bash
cp .env.example .env
docker compose up --build        # или: make up
```

- Веб: http://localhost:3000
- API и Swagger: http://localhost:8000/docs
- Статус интеграций и LLM: http://localhost:8000/api/integrations

Что поднимается: `db` (PostgreSQL), `backend` (FastAPI), `frontend` (nginx), `ollama` (локальная LLM) и `ollama-init`. Последний один раз скачивает модель `qwen2.5:3b` (~2 ГБ) и завершается. Пока модель качается, AI Jana отвечает цитатами из базы знаний. Ход скачивания: `docker compose logs -f ollama-init`.

### Режим разработки (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build   # или: make dev
```

Фронт откроется на http://localhost:5173. Код `backend/` и `frontend/` смонтирован в контейнеры, поэтому изменения подхватываются без пересборки.

### Локальная LLM: два режима

| Режим | Как включить | Когда использовать |
|---|---|---|
| **Ollama в Docker** (по умолчанию) | `COMPOSE_PROFILES=ai` в `.env` | Всё одной командой, одинаково у всех |
| **Ollama на хосте** | `brew install ollama`, `ollama serve`, `ollama pull qwen2.5:3b`; в `.env`: `COMPOSE_PROFILES=` и `OLLAMA_BASE_URL=http://host.docker.internal:11434` | На Mac в 3–5 раз быстрее: Docker на macOS не видит GPU Apple Silicon |
| Без LLM | `LLM_PROVIDER=none` | Только цитаты из базы знаний, ничего скачивать не нужно |

Модель меняется переменной `LLM_MODEL`. Например, `qwen2.5:7b` даёт ответы лучше, но работает медленнее.

### Локально без Docker

```bash
# backend (SQLite, тестовые данные создаются автоматически)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload            # http://localhost:8000

# frontend (в другом терминале)
cd frontend
npm install
npm run dev                               # http://localhost:5173, /api проксируется на :8000
```

Сбросить демо-данные: удалить `backend/janamen.db` (или `docker compose down -v`) и перезапустить.

### Тесты

```bash
cd backend && pytest -q
```

## Тестовые учётные записи

Пароль у всех: `demo123`. Все люди и данные вымышлены.

| Роль | Email | Кто |
|---|---|---|
| Сотрудник | employee@jana.demo | Нурланова Алия, логистика |
| Сотрудник | employee2@jana.demo | Ахметов Данияр, логистика |
| Руководитель | manager@jana.demo | Касымов Ерлан, руководитель логистики |
| HR / админ | hr@jana.demo | Сапарова Айгерим |
| Руководитель (другой отдел) | finance@jana.demo | Бекенов Тимур, финансы |
| Сотрудник (другой отдел) | madina@jana.demo | Жумабаева Мадина, финансы |

Второй отдел (финансы) нужен, чтобы показать: руководитель логистики **не видит** данные финансов.

## Сценарии демонстрации

| # | Сценарий | Статус |
|---|---|---|
| 1 | Вход, профиль, быстрые сервисы, заявки, обучение, уведомления | ✅ |
| 2 | Заявка на отпуск/аванс и смена статуса | API ✅ · UI 🚧 |
| 3 | Руководитель видит только свою команду | API ✅ · UI 🚧 |
| 4 | Курс: материал, тест, прогресс | API ✅ · UI 🚧 |
| 5 | AI Jana отвечает со ссылкой на источник | API ✅ · UI 🚧 |
| 6 | Вопрос вне базы: честный отказ и эскалация в HR | API ✅ · UI 🚧 |

## Что реализовано, что на моках, что на будущее

| Часть | Статус |
|---|---|
| Авторизация JWT, 3 роли, RBAC на бэкенде | Реализовано |
| Кадровые данные (read-only) | Реализовано, источник: mock 1С:ЗУП |
| Заявки «Отпуск» и «Аванс»: workflow, история, проверка остатка | Реализовано |
| Проведение в 1С:ЗУП и регистрация в Documentolog | Mock-адаптеры (`backend/app/integrations`) |
| Уведомления | Реализовано (in-app) |
| Jana Academy: уроки, тест, прогресс, назначение курса | Реализовано |
| AI Jana: поиск по базе знаний, источник, отказ, ролевой доступ | Реализовано |
| AI Jana: генерация ответа локальной LLM (Ollama) только по найденным фрагментам | Реализовано, с fallback на цитату |
| RU/KZ | Переключатель и словари |
| Email/push, ЭЦП, рекрутинг, Performance | Дальнейшее развитие |

## Структура

```
backend/
  app/
    api/routes/        # auth, employees, requests, notifications, academy, assistant
    core/              # config, security (JWT), deps, permissions (все правила доступа)
    integrations/      # контракты 1С:ЗУП / Documentolog и mock-реализации
    models/            # SQLAlchemy-модели
    services/          # request_workflow, notifications, assistant
    seed.py            # тестовые данные
  knowledge_base/      # база знаний AI Jana (markdown)
  tests/
frontend/
  src/
    api/               # клиент и типы API
    auth/              # контекст авторизации, защита маршрутов
    components/        # Layout, UI-примитивы
    i18n/              # словари RU/KZ
    pages/
docs/ARCHITECTURE.md   # схема и места интеграций
TASKS.md               # распределение задач в команде
```

## Архитектура

См. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
