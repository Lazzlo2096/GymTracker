from fastapi import Request, Response

import hashlib
from typing import Any, Callable, Dict, Optional, Tuple, get_args

from db.models.postgres import User
from dependencies.db_session import db_session


def _is_excluded(value: object, exclude_type: object) -> bool:
    """Annotated[AsyncSession, Depends(...)] нельзя передать в isinstance (Py 3.12+)."""
    inner = get_args(exclude_type)

    if inner and isinstance(value, inner[0]):
        return True
    try:
        return isinstance(value, (exclude_type,))
    except TypeError:
        return False


def cache_scope_user_id(kwargs: Dict[str, Any]) -> int | None:
    """
    Id пользователя для сегментации Redis-ключа.

    Приоритет: auth_user / current_user (сессия), затем User в kwarg `user`,
    затем path/query `user_id`. Чужой user_id в query сюда не подставляется:
    иначе кэш владельца отдался бы зрителю без проверки доступа.
    """
    for name in ("auth_user", "current_user"):
        value = kwargs.get(name)
        if isinstance(value, User):
            return value.id

    user_val = kwargs.get("user")
    if isinstance(user_val, User):
        return user_val.id

    uid = kwargs.get("user_id")
    if isinstance(uid, int) and uid >= 0:
        return uid

    return None


def key_builder(
    func: Callable[..., Any],
    namespace: str,
    *,
    request: Optional[Request] = None,
    response: Optional[Response] = None,
    args: Tuple[Any, ...],
    kwargs: Dict[str, Any],
) -> str:
    exclude_types = (db_session,)
    cache_kw = {}
    for name, value in kwargs.items():
        if any(_is_excluded(value, t) for t in exclude_types):
            continue
        if name in ("auth_user", "current_user") and isinstance(value, User):
            continue
        if name == "user" and isinstance(value, User):
            continue
        cache_kw[name] = value

    cache_key = hashlib.md5(  # noqa: S324
        f"{func.__module__}:{func.__name__}:{args}:{cache_kw}".encode()
    ).hexdigest()

    scope_uid = cache_scope_user_id(kwargs)
    if scope_uid is not None:
        return f"{namespace}:u{scope_uid}:{cache_key}"
    return f"{namespace}:g:{cache_key}"


db_key_builder = key_builder
