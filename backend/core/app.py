"""Фабрика приложения FastAPI."""

from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from authx.exceptions import JWTDecodeError
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from project_config import CORS_DEFAULT_LOCAL_ORIGIN_REGEX, settings
from dependencies.auth import auth
from services.redis.rate_limiter import redis_lifespan, rate_limit_middleware
from utils.exception_handlers import register_errors_handlers

# Эндпоинты без Bearer в OpenAPI (логин/регистрация; refresh — только refresh-cookie)
_OPENAPI_NO_BEARER: frozenset[tuple[str, str]] = frozenset(
    {
        ("/api/v1/auth/login", "post"),
        ("/api/v1/auth/register", "post"),
        ("/api/v1/auth/refresh", "post"),
        ("/api/v1/health", "get"),
        # ("/api/v1/suggestions/suggest-workout-icon", "post"),
    }
)


def create_app(
    on_startup: Callable[[], Awaitable[None]] | None = None,
) -> FastAPI:
    """
    Создание и настройка экземпляра FastAPI.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with redis_lifespan(app):
            if on_startup is not None:
                await on_startup()
            yield

    app = FastAPI(title="GymTracker API", lifespan=lifespan)

    # Добавляем кастомную обработку ошибок
    register_errors_handlers(app)


    app.middleware("http")(rate_limit_middleware)

    @app.middleware("http")
    async def api_no_http_cache(request: Request, call_next):
        """fastapi-cache2 ставит Cache-Control: max-age=… — браузер/Expo Web кеширует GET отдельно от Redis."""
        response = await call_next(request)
        if request.url.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response

    # AuthX error handlers (иначе возможны 500 вместо корректных 401)
    auth.handle_errors(app)

    # AuthX по умолчанию отдаёт JWTDecodeError как 422; мобильный клиент обновляет сессию по 401.
    async def _jwt_decode_unauthorized(
        _request: Request, exc: JWTDecodeError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"message": "Invalid Token", "error_type": exc.__class__.__name__},
        )

    app.add_exception_handler(JWTDecodeError, _jwt_decode_unauthorized)

    def custom_openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=getattr(app, "version", "0.1.0"),
            openapi_version=getattr(app, "openapi_version", "3.1.0"),
            description=getattr(app, "description", None),
            routes=app.routes,
        )
        components = schema.setdefault("components", {})
        schemes = components.setdefault("securitySchemes", {})
        schemes["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": (
                "Вставьте значение поля **access_token** из ответа POST /api/v1/auth/login "
                "(Swagger подставит префикс Bearer автоматически)."
            ),
        }
        schema["security"] = [{"BearerAuth": []}]
        paths = schema.get("paths")

        if isinstance(paths, dict):
            for path_key, path_item in paths.items():
                if not isinstance(path_item, dict):
                    continue

                path_norm = path_key.rstrip("/") or "/"
                for method, operation in path_item.items():
                    if method not in (
                        "get",
                        "put",
                        "post",
                        "delete",
                        "options",
                        "head",
                        "patch",
                        "trace",
                    ):
                        continue
                    if not isinstance(operation, dict):
                        continue
                    if (path_norm, method.lower()) in _OPENAPI_NO_BEARER:
                        operation["security"] = []

        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[method-assign]

    _cors_origins = list(settings.CORS_ALLOWED_ORIGINS)
    _cors_regex = settings.CORS_ALLOW_ORIGIN_REGEX or (
        None if _cors_origins else CORS_DEFAULT_LOCAL_ORIGIN_REGEX
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_origin_regex=_cors_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    Instrumentator().instrument(app).expose(app)

    return app
