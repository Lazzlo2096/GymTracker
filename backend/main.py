"""Точка входа бэкенда GymTracker."""

from project_config import configure_logging

configure_logging()

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from core.app import create_app
from project_config import settings

from routers import include_routers
from startup import on_startup

app = create_app(on_startup=on_startup)
include_routers(app)

Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
app.mount(
    settings.MEDIA_URL_PREFIX,
    StaticFiles(directory=settings.MEDIA_ROOT),
    name="media",
)
