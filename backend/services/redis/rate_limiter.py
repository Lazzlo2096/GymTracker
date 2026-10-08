from contextlib import asynccontextmanager
from functools import lru_cache
import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from starlette.responses import Response
from pyrate_limiter import Duration, Limiter, Rate
from pyrate_limiter.buckets import RedisBucket

from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

from project_config import configure_logging, settings

configure_logging()

rate_limiter: Limiter | None = None
_named_limiters: dict[str, Limiter] = {}


@lru_cache
def get_redis() -> Redis:
    # decode_responses=False: fastapi-cache и pyrate_limiter ожидают bytes из Redis
    return Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=False,
    )


async def _get_or_create_named_limiter(
    scope: str,
    limit: int,
    window_seconds: int,
) -> Limiter:
    cache_key = f"{scope}:{limit}:{window_seconds}"
    if cache_key in _named_limiters:
        return _named_limiters[cache_key]

    redis = get_redis()
    rates = [Rate(limit, Duration.SECOND * window_seconds)]
    bucket = await RedisBucket.init(rates, redis, f"rate-limit:{scope}")
    limiter = Limiter(bucket)
    _named_limiters[cache_key] = limiter
    return limiter


def rate_limiter_factory(
    scope: str,
    limit: int,
    window_seconds: int,
) -> Callable:
    """
    FastAPI dependency: не более `limit` запросов за `window_seconds` секунд на IP.
    Использование: dependencies=[Depends(rate_limiter_factory("auth_login", 40, 300))]
    """

    async def _check(request: Request) -> None:
        limiter = await _get_or_create_named_limiter(scope, limit, window_seconds)
        client_ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{client_ip}"
        allowed = await limiter.try_acquire_async(key, blocking=False)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too Many Requests. Превышен лимит запросов.",
            )

    return _check


@asynccontextmanager
async def redis_lifespan(app: FastAPI):
    """Lifespan: Redis обязателен — без него API не стартует."""

    global rate_limiter

    redis = get_redis()
    logging.info(
        "Проверка соединения с Redis (%s:%s)...",
        settings.REDIS_HOST,
        settings.REDIS_PORT,
    )
    await redis.ping()
    logging.info("Redis работает")

    FastAPICache.init(
        RedisBackend(redis),
        prefix="fastapi-cache",
        enable=settings.ENABLE_REDIS_CACHE,
    )
    if settings.ENABLE_REDIS_CACHE:
        logging.info("Redis-кэш GET (fastapi-cache2): включён")
    else:
        logging.info(
            "Redis-кэш GET (fastapi-cache2): ОТКЛЮЧЕН (ENABLE_REDIS_CACHE=false). "
            "Rate limit через Redis активен."
        )
    rates = [Rate(50, Duration.SECOND * 5)]
    redis_bucket = await RedisBucket.init(rates, redis, "api-rate-limits")
    rate_limiter = Limiter(redis_bucket)

    yield

    await redis.aclose()
    _named_limiters.clear()
    rate_limiter = None
    logging.info("Redis отключен")


def get_rate_limiter() -> Limiter | None:
    return rate_limiter


# Не лимитируем метрики, документацию и статику
_RATE_LIMIT_SKIP_PREFIXES = (
    "/metrics",
    "/api/docs",
    "/api/openapi.json",
    "/api/v1/health",
    "/media/",
)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def rate_limit_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Глобальный лимит: 50 запросов / 5 с на IP+path (Redis)."""
    path = request.url.path
    if path.startswith(_RATE_LIMIT_SKIP_PREFIXES):
        return await call_next(request)

    limiter = get_rate_limiter()
    if limiter is None:
        return await call_next(request)

    rate_limit_key = f"{_client_ip(request)}:{path}"
    allowed = await limiter.try_acquire_async(rate_limit_key, blocking=False)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too Many Requests. Превышен лимит запросов."},
        )

    return await call_next(request)
