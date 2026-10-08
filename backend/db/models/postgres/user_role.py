"""Роли пользователя (хранятся в users.role как строка)."""

from enum import Enum


class UserRole(str, Enum):
    """Роль определяет доступ к списку тренировок и др."""

    user = "user"
    trainer = "trainer"
    admin = "admin"
