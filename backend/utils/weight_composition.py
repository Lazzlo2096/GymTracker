"""Вычисление и разрешение weight_composition v1 для подходов."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.postgres.user_weight import UserWeight
from schemas.weight_composition import WeightCompositionV1

BODYWEIGHT_SOURCE_HISTORY = "user_bodyweight_history"
BODYWEIGHT_SOURCE_USER_ENTERED = "user_entered_now"


def _resolve_bodyweight_kg(term: dict[str, Any]) -> float | None:
    source = term.get("source")
    if source == BODYWEIGHT_SOURCE_USER_ENTERED:
        bw = term.get("user_entered_bodyweight_kg")
    else:
        bw = term.get("cached_bodyweight_kg")
    if isinstance(bw, (int, float)) and float(bw) == float(bw):
        return float(bw)
    return None


def _format_kg_display(kg: float) -> str:
    rounded = round(kg, 3)
    if rounded == int(rounded):
        return str(int(rounded))
    text = f"{rounded:.2f}".rstrip("0").rstrip(".")
    return text


def plates_meta_label(meta: dict[str, Any] | None) -> str:
    if not meta:
        return "блины"
    for key in ("placement", "label"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for value in meta.values():
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "блины"


def bar_meta_label(meta: dict[str, Any] | None) -> str:
    if not meta:
        return "гриф"
    label = meta.get("label")
    if isinstance(label, str) and label.strip():
        return label.strip()
    return "гриф"


def sum_plates_term_kg(term: dict[str, Any]) -> float:
    raw_kgs = term.get("kgs")
    if not isinstance(raw_kgs, list):
        return 0.0
    total = 0.0
    for item in raw_kgs:
        if isinstance(item, (int, float)) and float(item) == float(item):
            total += float(item)
    if term.get("mirror") is True:
        total *= 2
    return round(total, 3)


def compute_weight_composition_caches(
    composition: dict[str, Any],
) -> tuple[float | None, str | None]:
    """Пересчитать cached_effective_kg и cached_display из terms."""
    effective_parts: list[float] = []
    display_parts: list[str] = []

    terms = composition.get("terms")
    if not isinstance(terms, list):
        return None, None

    for raw_term in terms:
        if not isinstance(raw_term, dict):
            continue
        kind = raw_term.get("kind")

        if kind == "bodyweight":
            bw = _resolve_bodyweight_kg(raw_term)
            if bw is not None:
                effective_parts.append(bw)
            display_parts.append("св. вес")
            continue

        if kind == "plates":
            plates_sum = sum_plates_term_kg(raw_term)
            if plates_sum:
                effective_parts.append(plates_sum)
            meta = raw_term.get("meta")
            label = plates_meta_label(meta if isinstance(meta, dict) else None)
            if plates_sum:
                display_parts.append(f"{label} {_format_kg_display(plates_sum)}кг")
            elif label:
                display_parts.append(label)
            continue

        if kind == "bar":
            bar_kg = raw_term.get("bar_kg")
            if isinstance(bar_kg, (int, float)) and float(bar_kg) == float(bar_kg):
                value = float(bar_kg)
                effective_parts.append(value)
            meta = raw_term.get("meta")
            label = bar_meta_label(meta if isinstance(meta, dict) else None)
            if isinstance(bar_kg, (int, float)) and float(bar_kg) == float(bar_kg):
                display_parts.append(f"{label} {_format_kg_display(float(bar_kg))}кг")
            elif label:
                display_parts.append(label)

    effective_kg = round(sum(effective_parts), 3) if effective_parts else None
    display = " + ".join(display_parts) if display_parts else None
    if display:
        display = display[:128]
    return effective_kg, display


def refresh_weight_composition_dict(
    composition: dict[str, Any],
    *,
    bodyweight_kg: float | None = None,
) -> dict[str, Any]:
    """Обновить cached_* в копии composition, не перетирая исторический снимок веса."""
    result = dict(composition)
    terms_in = result.get("terms")
    if not isinstance(terms_in, list):
        terms_in = []

    terms_out: list[dict[str, Any]] = []
    for raw_term in terms_in:
        if not isinstance(raw_term, dict):
            continue
        term = dict(raw_term)
        if (
            term.get("kind") == "bodyweight"
            and term.get("source") == BODYWEIGHT_SOURCE_HISTORY
            and bodyweight_kg is not None
            and _resolve_bodyweight_kg(term) is None
        ):
            term["cached_bodyweight_kg"] = round(float(bodyweight_kg), 3)
            term["source"] = BODYWEIGHT_SOURCE_HISTORY
        terms_out.append(term)

    result["terms"] = terms_out
    result["version"] = 1
    cached_kg, cached_display = compute_weight_composition_caches(result)
    result["cached_effective_kg"] = cached_kg
    result["cached_display"] = cached_display
    return result


def parse_weight_composition(raw: Any) -> WeightCompositionV1 | None:
    if raw is None:
        return None
    if isinstance(raw, WeightCompositionV1):
        return raw
    if not isinstance(raw, dict):
        return None
    try:
        return WeightCompositionV1.model_validate(raw)
    except ValidationError:
        return None


def resolve_weight_kg(entry: dict[str, Any]) -> float | None:
    """weight_kg приоритетен; иначе weight_composition.cached_effective_kg."""
    weight = entry.get("weight_kg")
    if weight is None:
        weight = entry.get("weight")
    if isinstance(weight, (int, float)) and float(weight) == float(weight):
        return float(weight)

    composition = entry.get("weight_composition")
    if isinstance(composition, dict):
        cached = composition.get("cached_effective_kg")
        if isinstance(cached, (int, float)) and float(cached) == float(cached):
            return float(cached)
    return None


def resolve_weight_string(entry: dict[str, Any]) -> str | None:
    """weight_string приоритетен; иначе weight_composition.cached_display."""
    raw = entry.get("weight_string")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()

    composition = entry.get("weight_composition")
    if isinstance(composition, dict):
        cached = composition.get("cached_display")
        if isinstance(cached, str) and cached.strip():
            return cached.strip()
    return None


def composition_needs_bodyweight_refresh(composition: dict[str, Any]) -> bool:
    terms = composition.get("terms")
    if not isinstance(terms, list):
        return False
    for term in terms:
        if not isinstance(term, dict) or term.get("kind") != "bodyweight":
            continue
        if (
            term.get("source") == BODYWEIGHT_SOURCE_HISTORY
            and _resolve_bodyweight_kg(term) is None
        ):
            return True
    return False


async def fetch_latest_user_bodyweight_kg(
    session: AsyncSession,
    user_id: int,
) -> float | None:
    row = await session.scalar(
        select(UserWeight.weight_kg)
        .where(UserWeight.user_id == user_id)
        .order_by(desc(UserWeight.measured_at), desc(UserWeight.created_at))
        .limit(1)
    )
    if row is None:
        return None
    return round(float(row), 3)


async def normalize_set_entry_for_storage(
    session: AsyncSession,
    user_id: int,
    entry: dict[str, Any],
) -> dict[str, Any]:
    """Пересчитать cached_* в weight_composition перед записью в sets_json."""
    if entry.get("type") != "set":
        return entry

    composition = entry.get("weight_composition")
    if not isinstance(composition, dict):
        return entry

    bodyweight_kg: float | None = None
    if composition_needs_bodyweight_refresh(composition):
        bodyweight_kg = await fetch_latest_user_bodyweight_kg(session, user_id)

    entry = dict(entry)
    entry["weight_composition"] = refresh_weight_composition_dict(
        composition,
        bodyweight_kg=bodyweight_kg,
    )
    return entry
