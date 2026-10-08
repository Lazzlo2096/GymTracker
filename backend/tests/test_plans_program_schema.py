"""Тесты схемы program_json и legacy-нормализации."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas.plans import (
    ProgramSequenceCreate,
    ProgramWeekFixedCreate,
    normalize_legacy_program_json,
    program_out_adapter,
)


def test_normalize_legacy_sequence_missing_state_becomes_next() -> None:
    payload = normalize_legacy_program_json(
        {
            "id": 1,
            "name": "Legacy",
            "schedule_type": "sequence",
            "days": [
                {
                    "slot": 1,
                    "kind": "workout",
                    "template_id": 2,
                    "enabled": True,
                },
            ],
        }
    )
    out = program_out_adapter.validate_python(payload)
    assert out.schedule_type == "sequence"
    assert out.days[0].state == "next"


def test_normalize_week_fixed_strips_state() -> None:
    payload = normalize_legacy_program_json(
        {
            "id": 1,
            "name": "WF",
            "schedule_type": "week_fixed",
            "days": [
                {
                    "slot": 1,
                    "kind": "workout",
                    "iso_weekday": 1,
                    "template_id": 2,
                    "enabled": True,
                    "state": "next",
                },
            ],
        }
    )
    out = program_out_adapter.validate_python(payload)
    assert out.days[0].model_dump().get("state") is None


def test_sequence_create_requires_state_and_single_next() -> None:
    with pytest.raises(ValidationError):
        ProgramSequenceCreate.model_validate(
            {
                "name": "Bad",
                "schedule_type": "sequence",
                "days": [
                    {
                        "slot": 1,
                        "kind": "workout",
                        "template_id": 2,
                        "enabled": True,
                    },
                ],
            }
        )

    with pytest.raises(ValidationError):
        ProgramSequenceCreate.model_validate(
            {
                "name": "Bad",
                "schedule_type": "sequence",
                "days": [
                    {
                        "slot": 1,
                        "kind": "workout",
                        "template_id": 2,
                        "enabled": True,
                        "state": "next",
                    },
                    {
                        "slot": 2,
                        "kind": "workout",
                        "template_id": 3,
                        "enabled": True,
                        "state": "next",
                    },
                ],
            }
        )

    body = ProgramSequenceCreate.model_validate(
        {
            "name": "OK",
            "schedule_type": "sequence",
            "days": [
                {
                    "slot": 1,
                    "kind": "workout",
                    "template_id": 2,
                    "enabled": True,
                    "state": "done",
                },
                {
                    "slot": 2,
                    "kind": "workout",
                    "template_id": 3,
                    "enabled": True,
                    "state": "next",
                },
            ],
        }
    )
    assert body.days[1].state == "next"


def test_week_fixed_create_rejects_state() -> None:
    with pytest.raises(ValidationError):
        ProgramWeekFixedCreate.model_validate(
            {
                "name": "Bad",
                "schedule_type": "week_fixed",
                "days": [
                    {
                        "slot": 1,
                        "kind": "workout",
                        "iso_weekday": 1,
                        "template_id": 2,
                        "enabled": True,
                        "state": "next",
                    },
                ],
            }
        )
