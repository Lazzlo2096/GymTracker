"""
Группы кеширования GET-ручек API (fastapi-cache2 / Redis).

См. реестр: backend/cache_endpoint_groups.md
"""

from collections.abc import Callable
from enum import Enum
from typing import Any, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

_CACHE_GROUP_ATTR = "__cache_group__"


class CacheGroup(str, Enum):
    """Уровень кеширования для HTTP GET."""

    # Активная тренировка / каталог: без Redis, всегда свежие данные.
    HOT0 = "HOT0"
    # Частые персональные чтения: Redis + короткий TTL + invalidate всего namespace.
    HOT1 = "HOT1"
    # Реже меняющиеся списки/карточки: Redis + invalidate.
    WARM1 = "WARM1"
    # Стабильные или редкие GET: Redis, длиннее TTL.
    COLD1 = "COLD1"
    # Кеш не используется (health, публичные списки и т.п.).
    NONE = "NONE"


def mark_cache_group(group: CacheGroup) -> Callable[[F], F]:
    """Пометить хендлер группой (для реестра и будущей per-user invalidation)."""

    def decorator(func: F) -> F:
        setattr(func, _CACHE_GROUP_ATTR, group.value)
        return func

    return decorator


def get_cache_group(func: Callable[..., Any]) -> CacheGroup | None:
    raw = getattr(func, _CACHE_GROUP_ATTR, None)
    if raw is None:
        return None
    try:
        return CacheGroup(raw)
    except ValueError:
        return None
