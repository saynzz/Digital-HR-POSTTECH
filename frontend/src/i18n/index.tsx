import { createContext, useContext, useState, type ReactNode } from "react";

const ru = {
  "app.name": "JanaMen",
  "nav.home": "Главная",
  "nav.requests": "Мои заявки",
  "nav.team": "Команда",
  "nav.academy": "Jana Academy",
  "nav.assistant": "AI Jana",
  "nav.notifications": "Уведомления",
  "nav.hr": "HR-панель",
  "auth.login": "Войти",
  "auth.logout": "Выйти",
  "auth.email": "Email",
  "auth.password": "Пароль",
  "role.employee": "Сотрудник",
  "role.manager": "Руководитель",
  "role.hr": "HR / администратор",
  "type.vacation": "Отпуск",
  "type.advance": "Аванс",
  "status.pending_manager": "У руководителя",
  "status.pending_hr": "В HR",
  "status.approved": "Оформлено",
  "status.rejected": "Отклонено",
  "status.cancelled": "Отозвано",
  "profile.position": "Должность",
  "profile.department": "Подразделение",
  "profile.manager": "Руководитель",
  "profile.hire_date": "Дата приёма",
  "profile.company": "Компания",
  "profile.vacation_balance": "Остаток отпуска",
  "profile.days": "дн.",
  "profile.readonly": "Данные из 1С:ЗУП, только для чтения",
  "home.quick": "Быстрые сервисы",
  "home.new_vacation": "Оформить отпуск",
  "home.new_advance": "Запросить аванс",
  "home.ask": "Спросить AI Jana",
  "home.my_requests": "Последние заявки",
  "home.my_courses": "Моё обучение",
  "home.notifications": "Уведомления",
  "common.all": "Все",
  "common.empty": "Пока пусто",
  "common.loading": "Загрузка…",
  "common.todo": "Раздел в разработке",
};

type Dict = typeof ru;
export type TKey = keyof Dict;

const kz: Partial<Dict> = {
  "nav.home": "Басты бет",
  "nav.requests": "Менің өтінімдерім",
  "nav.team": "Команда",
  "nav.notifications": "Хабарламалар",
  "nav.hr": "HR-панель",
  "auth.login": "Кіру",
  "auth.logout": "Шығу",
  "auth.password": "Құпиясөз",
  "role.employee": "Қызметкер",
  "role.manager": "Басшы",
  "role.hr": "HR / әкімші",
  "type.vacation": "Демалыс",
  "type.advance": "Аванс",
  "status.pending_manager": "Басшыда",
  "status.pending_hr": "HR-да",
  "status.approved": "Ресімделді",
  "status.rejected": "Қабылданбады",
  "status.cancelled": "Кері қайтарылды",
  "profile.position": "Лауазымы",
  "profile.department": "Бөлімше",
  "profile.manager": "Басшы",
  "profile.hire_date": "Жұмысқа қабылданған күні",
  "profile.company": "Компания",
  "profile.vacation_balance": "Демалыс қалдығы",
  "profile.days": "күн",
  "home.quick": "Жылдам қызметтер",
  "home.new_vacation": "Демалыс рәсімдеу",
  "home.new_advance": "Аванс сұрау",
  "home.ask": "AI Jana-дан сұрау",
  "home.my_requests": "Соңғы өтінімдер",
  "home.my_courses": "Менің оқуым",
  "home.notifications": "Хабарламалар",
  "common.empty": "Әзірге бос",
  "common.loading": "Жүктелуде…",
};

const dicts: Record<Lang, Partial<Dict>> = { ru, kz };
export type Lang = "ru" | "kz";

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "ru");
  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };
  const t = (k: TKey) => dicts[lang][k] ?? ru[k];
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
