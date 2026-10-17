import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import { api } from "../api/client";
import type { InviteInfo } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorText, Field, inputCls } from "../components/ui";

const RULES = [
  { test: (p: string) => p.length >= 8, label: "Не короче 8 символов" },
  { test: (p: string) => /[A-Za-zА-Яа-яЁё]/.test(p), label: "Есть буквы" },
  { test: (p: string) => /\d/.test(p), label: "Есть цифры" },
];

export default function Activate() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { activate } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLinkError("В ссылке нет кода приглашения. Откройте ссылку из письма целиком.");
      return;
    }
    api.inviteInfo(token).then(setInfo).catch((e) => setLinkError((e as Error).message));
  }, [token]);

  const valid = RULES.every((r) => r.test(password)) && password === repeat;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await activate(token, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-3xl font-extrabold tracking-tight">
          <span className="text-brand-600">JANA</span>MEN
        </p>

        {linkError && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-semibold">Ссылка не работает</p>
            <p className="mt-2 text-sm text-gray-600">{linkError}</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Перейти ко входу</Link>
          </div>
        )}

        {!linkError && !info && <p className="text-center text-sm text-gray-400">Проверяем ссылку…</p>}

        {info && (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-lg font-semibold">
                {info.is_reset ? "Новый пароль" : `Здравствуйте, ${info.full_name.split(" ")[1] ?? info.full_name}!`}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {info.is_reset
                  ? `${info.full_name}, задайте новый пароль для входа в JanaMen.`
                  : `Вы — ${info.position}, ${info.company}. Придумайте пароль, чтобы войти в JanaMen.`}
              </p>
            </div>
            <Field label="Логин">
              <input className={inputCls} value={info.email} disabled />
            </Field>
            <Field label="Пароль" required>
              <input className={inputCls} type="password" autoComplete="new-password" autoFocus value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ul className="space-y-1 text-xs">
              {RULES.map((r) => {
                const ok = r.test(password);
                return (
                  <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-brand-700" : "text-gray-400"}`}>
                    {ok ? <Check size={14} /> : <X size={14} />} {r.label}
                  </li>
                );
              })}
            </ul>
            <Field label="Повторите пароль" required>
              <input className={inputCls} type="password" autoComplete="new-password" value={repeat}
                onChange={(e) => setRepeat(e.target.value)} />
            </Field>
            {repeat && password !== repeat && <p className="text-xs text-red-600">Пароли не совпадают</p>}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={!valid || busy} className="w-full">
              {info.is_reset ? "Сохранить и войти" : "Создать пароль и войти"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-gray-400">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              Ссылка одноразовая. Пароль знаете только вы — HR его не видит.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
