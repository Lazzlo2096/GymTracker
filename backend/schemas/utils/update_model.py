from typing import Any, Annotated

from pydantic import BaseModel, ConfigDict, Field, create_model
from pydantic.fields import FieldInfo


def _exclude_fields(
    fields: dict[str, FieldInfo],
    exclude: set[str] | None = None,
) -> dict[str, FieldInfo]:
    """Вернуть словарь полей без исключённых имён."""
    exclude = exclude or set()
    return {
        field_name: field_info
        for field_name, field_info in fields.items()
        if field_name not in exclude
    }


def _optionalize_fields(
    fields: dict[str, FieldInfo],
) -> dict[str, tuple[Any, Any]]:
    """
    Превратить поля в optional-поля для create_model:
    annotation -> annotation | None, default -> None.
    """
    new_fields: dict[str, tuple[Any, Any]] = {}

    for field_name, field_info in fields.items():
        field_dict = field_info.asdict()
        attributes = dict(field_dict["attributes"])

        # create_model получает default=None вторым элементом кортежа.
        # Унаследованные default и default_factory нужно снять, иначе
        # pydantic ругается: cannot specify both default and default_factory.
        attributes.pop("default", None)
        attributes.pop("default_factory", None)

        new_fields[field_name] = (
            Annotated[
                field_dict["annotation"] | None,
                *field_dict["metadata"],
                Field(**attributes),
            ],
            None,
        )

    return new_fields


def make_update_model(
    model_cls: type[BaseModel],
    model_name: str,
    *,
    exclude: set[str] | None = None,
) -> type[BaseModel]:
    """
    Собрать модель для PATCH: те же поля, что у model_cls, но все optional.

    Каждое оставшееся поле становится T | None = None. Имена из exclude
    в новую модель не попадают. Поле можно не передавать или передать None.
    """
    fields = _exclude_fields(model_cls.model_fields, exclude)
    new_fields = _optionalize_fields(fields)
    return create_model(
        model_name,
        __config__=ConfigDict(**dict(model_cls.model_config)),
        **new_fields,
    )
