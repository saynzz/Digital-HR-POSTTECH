import { Placeholder } from "../components/ui";

export const RequestNew = () => (
  <Placeholder title="Новая заявка" todo={[
    "Выбор типа: Отпуск / Аванс (тип из ?type= в URL)",
    "Отпуск: даты начала/окончания, подсчёт дней, показать остаток",
    "Аванс: сумма, комментарий",
    "После отправки — редирект в карточку заявки",
  ]} endpoints={["POST /api/requests", "GET /api/auth/me (остаток отпуска)"]} />
);

export const RequestDetail = () => (
  <Placeholder title="Карточка заявки" todo={[
    "Тип, параметры, текущий статус, № документа Documentolog",
    "Таймлайн истории (events)",
    "Кнопки Согласовать/Отклонить, если can_decide",
    "Кнопка Отозвать, если can_cancel",
  ]} endpoints={["GET /api/requests/:id", "POST /api/requests/:id/decision", "POST /api/requests/:id/cancel"]} />
);

export const Team = () => (
  <Placeholder title="Команда" todo={[
    "Список подчинённых (у HR — все сотрудники)",
    "Заявки команды, ожидающие решения",
    "Назначить курс сотруднику",
  ]} endpoints={["GET /api/team", "GET /api/requests?scope=team", "POST /api/academy/assign"]} />
);

export const Academy = () => (
  <Placeholder title="Jana Academy" todo={["Назначенные курсы с прогрессом", "Каталог курсов"]}
    endpoints={["GET /api/academy/my", "GET /api/academy/courses", "POST /api/academy/courses/:id/start"]} />
);

export const CourseView = () => (
  <Placeholder title="Курс" todo={["Уроки по порядку, отметка «пройдено»", "Тест в конце, результат и статус"]}
    endpoints={["GET /api/academy/courses/:id", "POST /api/academy/courses/:id/lessons/:lid/complete", "POST /api/academy/courses/:id/quiz"]} />
);

export const Assistant = () => (
  <Placeholder title="AI Jana" todo={[
    "Чат: вопрос → ответ + карточка источника",
    "found=false → кнопка «Передать вопрос в HR»",
    "Подсказки типовых вопросов",
  ]} endpoints={["POST /api/assistant/ask"]} />
);

export const Notifications = () => (
  <Placeholder title="Уведомления" todo={["Список, непрочитанные выделены", "Клик → переход по link и пометка прочитанным", "Прочитать все"]}
    endpoints={["GET /api/notifications", "POST /api/notifications/:id/read", "POST /api/notifications/read-all"]} />
);
