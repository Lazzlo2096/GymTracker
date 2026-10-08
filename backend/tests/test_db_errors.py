"""Классификация IntegrityError без базы."""

from sqlalchemy.exc import IntegrityError

from utils.db_errors import is_unique_violation


class _Orig:
    def __init__(self, sqlstate: str) -> None:
        self.sqlstate = sqlstate


def test_unique_violation_by_sqlstate() -> None:
    exc = IntegrityError("msg", "INSERT", {}, _Orig("23505"))
    assert is_unique_violation(exc) is True


def test_foreign_key_is_not_unique_violation() -> None:
    exc = IntegrityError("msg", "INSERT", {}, _Orig("23503"))
    assert is_unique_violation(exc) is False


def test_unique_violation_by_asyncpg_class_name() -> None:
    class UniqueViolationError(Exception):
        pass

    exc = IntegrityError("msg", "INSERT", {}, UniqueViolationError())
    assert is_unique_violation(exc) is True
