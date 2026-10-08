"""
Агрегация роутеров API v1.
Все роутеры объединяются здесь и монтируются под /api/v1.
"""

from fastapi import FastAPI, APIRouter

from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.exercise_in_catalog_actions import router as exercise_in_catalog_router
from routers.workout import router as workout_actions_router
from routers.exercise_in_workout import router as exercise_in_workout_router
from routers.exercise_in_workout_set_actions import (
    router as exercise_in_workout_set_actions_router,
)
from routers.user_gyms import router as user_gyms_router

from routers.trainer_clients_actions import router as trainer_clients_router
from routers.payments_yookassa import router as payments_yookassa_router
from routers.suggest_workout_icon import router as suggest_workout_icon_router
from routers.feature_ideas import router as feature_ideas_router
from routers.promo_codes import router as promo_codes_router
from routers.system_exercises import router as system_exercises_router
from routers.public_exercises import router as public_exercises_router
from routers.push_tokens import router as push_tokens_router
from routers.workout_templates import router as workout_templates_router
from routers.stats import router as stats_router
from routers.plans import router as plans_router
from routers.weight_diary import router as weight_diary_router
from routers.user_weights_crud import router as user_weights_crud_router

# Сборка основного роутера API v1
api_v1 = APIRouter(prefix="/api/v1")

# Health — первым: проверка живости бэка для Docker и клиентов (TGL-37)
api_v1.include_router(health_router)

# Auth (регистрация, логин, /me)
api_v1.include_router(auth_router)

# GET /user_weights/diary — до CRUD, иначе {item_id} перехватит "diary"
api_v1.include_router(weight_diary_router)
api_v1.include_router(user_weights_crud_router)

# Кастомные роутеры (возможно, с дополнительными действиями)
api_v1.include_router(exercise_in_catalog_router)
api_v1.include_router(user_gyms_router)
api_v1.include_router(workout_actions_router)
api_v1.include_router(exercise_in_workout_router)
api_v1.include_router(exercise_in_workout_set_actions_router)

api_v1.include_router(trainer_clients_router)
api_v1.include_router(payments_yookassa_router)
api_v1.include_router(suggest_workout_icon_router)
api_v1.include_router(feature_ideas_router)
api_v1.include_router(promo_codes_router)
api_v1.include_router(system_exercises_router)
api_v1.include_router(public_exercises_router)
api_v1.include_router(push_tokens_router)
api_v1.include_router(workout_templates_router)
api_v1.include_router(stats_router)
api_v1.include_router(plans_router)


def include_routers(app: FastAPI) -> None:
    """Подключение всех API-роутеров к приложению."""
    app.include_router(api_v1)
