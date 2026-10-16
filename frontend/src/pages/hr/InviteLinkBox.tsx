import { useState } from "react";
import { AlertTriangle, Check, Copy, Mail } from "lucide-react";
import type { InviteResult } from "../../api/types";
import { fmtDateTime } from "../../components/ui";

export default function InviteLinkBox({ invite }: { invite: InviteResult }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!invite.invite_url) return;
    try {
      await navigator.clipboard.writeText(invite.invite_url);
    } catch {
      const el = document.createElement("textarea");
      el.value = invite.invite_url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {invite.email_sent ? (
        <div className="flex gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
          <Mail size={18} className="mt-0.5 shrink-0" />
          <div>
            Письмо со ссылкой для создания пароля отправлено на <b>{invite.sent_to}</b>.
            <br />
            Ссылка одноразовая, действует до {fmtDateTime(invite.expires_at)}.
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            Письмо на <b>{invite.sent_to}</b> не отправлено{invite.email_error ? `: ${invite.email_error}` : ""}.
            <br />
            Передайте ссылку сотруднику лично. Она действует до {fmtDateTime(invite.expires_at)}.
          </div>
        </div>
      )}
      {invite.invite_url && (
        <div>
          <p className="mb-1 text-xs text-gray-500">{invite.email_sent ? "Копия ссылки для демо" : "Ссылка для передачи вручную"}</p>
          <div className="flex gap-2">
            <input readOnly value={invite.invite_url} onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs" />
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50">
              {copied ? <><Check size={16} className="text-brand-600" /> Скопировано</> : <><Copy size={16} /> Копировать</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
