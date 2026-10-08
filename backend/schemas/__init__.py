"""Pydantic schemas for request/response validation."""

from schemas.auth import UserMe
from schemas.exercise_in_catalog import (
    ExerciseInCatalogCreate,
    ExerciseInCatalogCreateResponse,
    ExerciseInCatalogDeleteResponse,
    ExerciseInCatalogOut,
    ExerciseInCatalogPatch,
    ExerciseInCatalogPatchResponse,
    ExerciseInCatalogReplace,
    ExerciseInCatalogReplaceResponse,
)
from schemas.workout import AddExerciseToWorkoutResponse
from schemas.exercise_in_workout_set import (
    SetData,
    SetUpdate,
    PlannedSetsUpdate,
    AddSetResponse,
    UpdateSetResponse,
    UpdateSetsResponse,
    PlannedSetsResponse,
    DeleteSetResponse,
)

__all__ = [
    "UserMe",
    "ExerciseInCatalogCreate",
    "ExerciseInCatalogCreateResponse",
    "ExerciseInCatalogDeleteResponse",
    "ExerciseInCatalogOut",
    "ExerciseInCatalogPatch",
    "ExerciseInCatalogPatchResponse",
    "ExerciseInCatalogReplace",
    "ExerciseInCatalogReplaceResponse",
    "AddExerciseToWorkoutResponse",
    "SetData",
    "SetUpdate",
    "PlannedSetsUpdate",
    "AddSetResponse",
    "UpdateSetResponse",
    "UpdateSetsResponse",
    "PlannedSetsResponse",
    "DeleteSetResponse",
]
