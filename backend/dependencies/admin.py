"""Зависимость: только admin."""

from typing import Annotated

from fastapi import Depends, HTTPException

from db.models.postgres import User
from db.models.postgres.user_role import UserRole
from dependencies.auth import get_current_user


async def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Требуется роль admin")
    return user


admin_user = Annotated[User, Depends(require_admin)]
