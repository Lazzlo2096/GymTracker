"""Статус идеи для чипа в UI (задаётся вручную в БД)."""

from enum import Enum


class FeatureIdeaStatus(str, Enum):
    """Публичный статус одобренной идеи."""

    IN_DEVELOPMENT = "in_development"
    ACCEPTED_TO_PLAN = "accepted_to_plan"
