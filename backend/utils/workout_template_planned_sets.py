"""Конвертация planned_sets между JSONB в БД и полями API (mobile + planned_set_timeline)."""

from __future__ import annotations

from typing import Any


def _set_entry_api_to_db(entry: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"type": "set"}
    if entry.get("weight_kg") is not None:
        out["weight_kg"] = entry["weight_kg"]
    weight = entry.get("weight_string") or entry.get("weight_label")
    if isinstance(weight, str) and weight.strip():
        out["weight_string"] = weight.strip()[:128]
    if entry.get("reps") is not None:
        out["reps"] = entry["reps"]
    reps = entry.get("reps_string") or entry.get("reps_label")
    if isinstance(reps, str) and reps.strip():
        out["reps_string"] = reps.strip()[:128]
    return out


def _set_entry_db_to_api(entry: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"type": "set"}
    if entry.get("weight_kg") is not None:
        out["weight_kg"] = entry["weight_kg"]
    weight = entry.get("weight_string")
    if isinstance(weight, str) and weight:
        out["weight_label"] = weight
    if entry.get("reps") is not None:
        out["reps"] = entry["reps"]
    reps = entry.get("reps_string")
    if isinstance(reps, str) and reps:
        out["reps_label"] = reps
    return out


def planned_sets_api_to_db(entries: list[Any] | None) -> list[dict[str, Any]]:
    if not entries:
        return []
    out: list[dict[str, Any]] = []
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        kind = raw.get("type")
        if kind == "rest":
            sec = raw.get("rest_seconds")
            if isinstance(sec, int) and sec >= 0:
                out.append({"type": "rest", "rest_seconds": sec})
            continue
        if kind == "set":
            out.append(_set_entry_api_to_db(raw))
    return out


def planned_sets_db_to_api(entries: list[Any] | None) -> list[dict[str, Any]]:
    if not entries:
        return []
    out: list[dict[str, Any]] = []
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        kind = raw.get("type")
        if kind == "rest":
            sec = raw.get("rest_seconds")
            if isinstance(sec, int) and sec >= 0:
                out.append({"type": "rest", "rest_seconds": sec})
            continue
        if kind == "set":
            out.append(_set_entry_db_to_api(raw))
    return out


def count_work_sets(entries: list[Any] | None) -> int:
    if not entries:
        return 0
    return sum(1 for e in entries if isinstance(e, dict) and e.get("type") == "set")


def is_uniform_simple_planned(entries: list[Any] | None) -> bool:
    """План можно описать одними полями N×reps/weight/rest (как planned_all_*)."""
    if not entries:
        return True

    work_sets = [e for e in entries if isinstance(e, dict) and e.get("type") == "set"]
    rests = [e for e in entries if isinstance(e, dict) and e.get("type") == "rest"]
    if not work_sets:
        return False

    first_set = work_sets[0]
    for entry in work_sets:
        if entry.get("reps") != first_set.get("reps"):
            return False
        if entry.get("weight_kg") != first_set.get("weight_kg"):
            return False
        w1 = entry.get("weight_string")
        w0 = first_set.get("weight_string")
        if (w1 or None) != (w0 or None):
            return False
        r1 = entry.get("reps_string")
        r0 = first_set.get("reps_string")
        if (r1 or None) != (r0 or None):
            return False

    if not rests:
        return len(work_sets) == 1 and len(entries) == 1

    first_rest = rests[0]
    for entry in rests:
        if entry.get("rest_seconds") != first_rest.get("rest_seconds"):
            return False

    expected_length = len(work_sets) * 2 - 1
    if len(entries) != expected_length:
        return False

    for i, entry in enumerate(entries):
        expected_type = "set" if i % 2 == 0 else "rest"
        if not isinstance(entry, dict) or entry.get("type") != expected_type:
            return False

    return True


def compute_planned_tonnage_kg(entries: list[Any] | None) -> float | None:
    """Сумма weight_kg × reps по рабочим подходам."""
    if not entries:
        return None
    total = 0.0
    found = False
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("type") != "set":
            continue
        weight = entry.get("weight_kg")
        reps = entry.get("reps")
        if weight is None or reps is None:
            continue
        try:
            total += float(weight) * int(reps)
            found = True
        except (TypeError, ValueError):
            continue
    return total if found else None


def derive_uniform_all_fields(
    entries: list[Any] | None,
) -> tuple[int | None, float | None, int | None]:
    """Из uniform planned_sets_json: (reps, weight_kg, rest_seconds)."""
    if not entries or not is_uniform_simple_planned(entries):
        return None, None, None

    work_sets = [e for e in entries if isinstance(e, dict) and e.get("type") == "set"]
    rests = [e for e in entries if isinstance(e, dict) and e.get("type") == "rest"]
    first_set = work_sets[0] if work_sets else None
    first_rest = rests[0] if rests else None

    reps = first_set.get("reps") if first_set else None
    weight = first_set.get("weight_kg") if first_set else None
    rest_sec = first_rest.get("rest_seconds") if first_rest else None

    reps_i = int(reps) if isinstance(reps, int) and reps >= 0 else None
    weight_f = float(weight) if isinstance(weight, (int, float)) else None
    rest_i = int(rest_sec) if isinstance(rest_sec, int) and rest_sec >= 0 else None
    return reps_i, weight_f, rest_i
