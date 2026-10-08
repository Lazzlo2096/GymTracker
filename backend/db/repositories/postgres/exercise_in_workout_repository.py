"""Доступ к строкам exercise_in_workout (PostgreSQL)."""

from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres import ExerciseInWorkout


async def get_exercise_in_workout(
    session: AsyncSession, exercise_in_workout_id: int
) -> ExerciseInWorkout | None:
    return await session.get(ExerciseInWorkout, exercise_in_workout_id)
