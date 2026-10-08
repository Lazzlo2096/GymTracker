"""Async SMTP через aiosmtplib."""

from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from project_config import settings

logger = logging.getLogger(__name__)


async def send_email_async(*, to: str, subject: str, html: str) -> None:
    """Отправляет HTML-письмо. Бросает исключение при ошибке транспорта."""
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Откройте письмо в клиенте с поддержкой HTML.")
    msg.add_alternative(html, subtype="html")

    use_ssl = settings.SMTP_USE_SSL
    start_tls = settings.SMTP_USE_TLS and not use_ssl
    username = settings.SMTP_USER.strip() or None
    password = settings.SMTP_PASSWORD.strip() or None

    async with aiosmtplib.SMTP(
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        use_tls=use_ssl,
        start_tls=start_tls,
        username=username,
        password=password,
        timeout=30,
    ) as smtp:
        await smtp.send_message(msg)
