import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { useI18n } from "../i18n";

const DEMO = [
  { email: "employee@jana.demo", label: "Сотрудник" },
  { email: "manager@jana.demo", label: "Руководитель" },
  { email: "hr@jana.demo", label: "HR" },
];

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-4xl font-extrabold tracking-tight">
            <span className="text-brand-600">JANA</span>MEN
          </p>
          <p className="mt-2 text-sm text-gray-500">Единая HR-платформа Jana Post</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium">{t("auth.email")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-brand-500" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("auth.password")}</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-brand-500" />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{t("auth.login")}</Button>
          <p className="text-center text-xs text-gray-400">
            Нет пароля или забыли его? Доступ выдаёт HR — ссылка для создания пароля придёт на рабочую почту.
          </p>
        </form>
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Демо-доступ</p>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.email} type="button"
                onClick={() => { setEmail(d.email); setPassword("demo123"); }}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
