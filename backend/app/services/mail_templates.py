from html import escape


def invite_email(full_name: str, position: str, url: str, first: bool, ttl_hours: int) -> tuple[str, str, str]:
    first_name = full_name.split(" ")[1] if len(full_name.split(" ")) > 1 else full_name
    if first:
        subject = "Доступ к Jana Hub — HR-платформе Jana Post"
        lead = f"Для вас создан доступ к Jana Hub — единой HR-платформе Jana Post ({position})."
        action = "Создать пароль"
    else:
        subject = "Восстановление доступа к Jana Hub"
        lead = "Мы получили запрос на смену пароля в Jana Hub."
        action = "Задать новый пароль"

    text = (
        f"Здравствуйте, {first_name}!\n\n{lead}\n"
        f"Чтобы войти, перейдите по ссылке и придумайте пароль:\n{url}\n\n"
        f"Ссылка одноразовая и действует {ttl_hours} ч. Пароль знаете только вы — HR его не видит.\n"
        "Если вы не ожидали это письмо, просто проигнорируйте его.\n\n— Команда HR Jana Post"
    )

    e = escape
    html = f"""<!doctype html>
<html lang="ru"><body style="margin:0;padding:0;background:#f3f6f2;font-family:Arial,Helvetica,sans-serif;color:#17251a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f2;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e3e8e1">
<tr><td style="padding:28px 32px 8px">
<span style="font-size:22px;font-weight:800;letter-spacing:-0.5px"><span style="color:#2f8a22">JANA</span>HUB</span>
</td></tr>
<tr><td style="padding:8px 32px 0">
<h1 style="margin:0 0 12px;font-size:20px">Здравствуйте, {e(first_name)}!</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">{e(lead)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">Чтобы войти, придумайте пароль — это займёт минуту.</p>
<a href="{e(url)}" style="display:inline-block;background:#2f8a22;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:12px">{e(action)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5f6b61">Кнопка не работает? Скопируйте ссылку в браузер:<br>
<a href="{e(url)}" style="color:#2f8a22;word-break:break-all">{e(url)}</a></p>
</td></tr>
<tr><td style="padding:24px 32px 28px">
<p style="margin:0;font-size:12px;line-height:1.5;color:#8a948c">Ссылка одноразовая и действует {ttl_hours} ч. Пароль знаете только вы — HR его не видит.
Если вы не ожидали это письмо, просто проигнорируйте его.</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#8a948c">Jana Post · HR-платформа Jana Hub</p>
</td></tr></table>
</body></html>"""
    return subject, text, html
