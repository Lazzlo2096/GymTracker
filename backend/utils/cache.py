"""
Общие настройки fastapi-cache2 для GET-ручек.

Группы кеширования (см. cache_groups.py, cache_endpoint_groups.md):
- HOT0 — без Redis (@mark_cache_group только).
- HOT1 / WARM1 / COLD1 — @cached_get + invalidate после мутаций.
"""

import logging
from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING, Any, TypeVar

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache

from cache_groups import CacheGroup, mark_cache_group
from project_config import (
    CACHE_DEFAULT_EXPIRE_SECONDS,
    CACHE_EXERCISE_EXPIRE_SECONDS,
    CACHE_WORKOUT_EXPIRE_SECONDS,
    settings,
)
from utils.fastapi_cache_key_builders.db_keybuilder import db_key_builder

ns = settings.cache_namespaces

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def cached_get(
    *,
    namespace: str,
    expire: int = CACHE_DEFAULT_EXPIRE_SECONDS,
    cache_group: CacheGroup = CacheGroup.WARM1,
) -> Callable[[F], F]:
    """Декоратор кэша с db_key_builder (без AsyncSession в ключе) + метка группы."""

    def wrapper(func: F) -> F:
        marked = mark_cache_group(cache_group)(func)
        return cache(
            expire=expire,
            key_builder=db_key_builder,
            namespace=namespace,
        )(marked)

    return wrapper


async def _redis_delete_keys_matching(redis, pattern: bytes) -> int:
    """SCAN + DEL (decode_responses=False → ключи bytes). Надёжнее KEYS в lua clear()."""

    deleted = 0
    async for key in redis.scan_iter(match=pattern):
        await redis.delete(key)
        deleted += 1
    return deleted


async def _invalidate_pattern(pattern: str, namespace: str) -> None:
    try:
        backend = FastAPICache.get_backend()
        prefix = FastAPICache.get_prefix()
    except AssertionError:
        return

    full_prefix = f"{prefix}:{namespace}" if namespace else prefix
    redis_pattern = f"{full_prefix}:{pattern}".encode()
    try:
        deleted = 0
        if isinstance(backend, RedisBackend):
            deleted = await _redis_delete_keys_matching(backend.redis, redis_pattern)
        if deleted == 0:
            await FastAPICache.clear(namespace=namespace)
    except Exception:
        logger.exception(
            "cache clear failed namespace=%s pattern=%s", namespace, pattern
        )


async def invalidate_namespaces(*namespaces: str) -> None:
    """Сбросить все ключи namespace (глобально, без сегментации по user_id)."""

    if not namespaces:
        return

    for namespace in namespaces:
        await _invalidate_pattern("*", namespace)


async def invalidate_namespaces_for_user(user_id: int, *namespaces: str) -> None:
    """Сбросить ключи namespace только для указанного пользователя."""

    if not namespaces or user_id < 0:
        return

    segment = f"u{user_id}:*"
    for namespace in namespaces:
        await _invalidate_pattern(segment, namespace)


async def invalidate_namespaces_for_users(
    user_ids: Iterable[int], *namespaces: str
) -> None:
    """Сбросить ключи namespace для нескольких пользователей (без дублей)."""

    for user_id in dict.fromkeys(user_ids):
        await invalidate_namespaces_for_user(user_id, *namespaces)


async def invalidate_catalog_cache(user_id: int) -> None:
    """После изменений каталога — сброс кэша карточки упражнения (список/сводка без кэша)."""

    await invalidate_namespaces_for_user(user_id, ns.get_exercise_catalog)


async def invalidate_user_gyms_cache(user_id: int) -> None:
    """Список залов и GET /auth/me (в ответе есть preferred_gym)."""

    await invalidate_namespaces_for_user(user_id, ns.list_user_gyms, ns.me)


async def invalidate_me_cache(user_id: int) -> None:
    """GET /auth/me."""

    await invalidate_namespaces_for_user(user_id, ns.me)


async def invalidate_user_weights_cache(user_id: int) -> None:
    """Список GET /user_weights/ владельца user_id."""

    await invalidate_namespaces_for_user(user_id, ns.list_user_weights_crud)


async def invalidate_trainer_clients_cache(*user_ids: int) -> None:
    """Список и карточка связи тренер ↔ клиент."""

    await invalidate_namespaces_for_users(
        user_ids,
        ns.list_trainer_clients,
        ns.get_trainer_client,
    )


async def invalidate_workouts_cache(*user_ids: int) -> None:
    """Список и карточка тренировки (после create/update/delete и изменений упражнений/подходов)."""

    await invalidate_namespaces_for_users(
        user_ids,
        ns.list_workouts,
        ns.get_workout,
    )


async def invalidate_workout_templates_cache(user_id: int) -> None:
    """Сброс кеша шаблонов тренировок пользователя."""

    await invalidate_namespaces_for_user(
        user_id,
        ns.list_workout_templates,
        ns.get_workout_template,
    )


async def invalidate_workouts_cache_scoped(
    session: "AsyncSession",
    *workout_owner_ids: int,
    also_invalidate: Iterable[int] = (),
) -> None:
    """
    Сброс кеша тренировок для владельцев, актора и их тренеров (trainer_clients).

    Кеш списка тренировок лежит под u{viewer_id}; при изменении данных подопечного
    нужно сбросить и кеш связанных тренеров, иначе они увидят устаревший список до TTL.
    """
    from db.repositories.postgres.workout_repository import list_trainer_ids_for_client

    ids: set[int] = set(also_invalidate)
    for owner_id in dict.fromkeys(workout_owner_ids):
        ids.add(owner_id)
        ids.update(await list_trainer_ids_for_client(session, owner_id))
    await invalidate_workouts_cache(*ids)
