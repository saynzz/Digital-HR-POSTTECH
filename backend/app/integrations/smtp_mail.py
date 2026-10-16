import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid


class MailDeliveryError(Exception):
    pass


class SMTPMailAdapter:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str, sender_name: str,
                 use_ssl: bool = False, timeout: float = 20):
        self.host, self.port = host, port
        self.user, self.password = user, password.replace(" ", "")
        self.sender, self.sender_name = sender or user, sender_name
        self.use_ssl, self.timeout = use_ssl, timeout

    def send(self, to: str, subject: str, body: str, html: str | None = None) -> None:
        if not self.user or not self.password:
            raise MailDeliveryError("Почта не настроена: укажите SMTP_USER и SMTP_PASSWORD в .env")
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = formataddr((self.sender_name, self.sender))
        msg["To"] = to
        msg["Message-ID"] = make_msgid(domain=self.sender.split("@")[-1])
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")

        context = ssl.create_default_context()
        try:
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout, context=context)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
            with server:
                if not self.use_ssl:
                    server.starttls(context=context)
                server.login(self.user, self.password)
                server.send_message(msg)
        except smtplib.SMTPAuthenticationError as e:
            raise MailDeliveryError(
                "Почтовый сервер отклонил вход: проверьте SMTP_USER и пароль приложения Gmail") from e
        except smtplib.SMTPRecipientsRefused as e:
            raise MailDeliveryError(f"Адрес {to} отклонён почтовым сервером") from e
        except (OSError, smtplib.SMTPException) as e:
            raise MailDeliveryError(f"Не удалось отправить письмо: {type(e).__name__}") from e
