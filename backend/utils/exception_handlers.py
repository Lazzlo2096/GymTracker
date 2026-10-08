import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import DatabaseError
from typing import Any

from project_config import configure_logging

log = logging.getLogger(__name__)
configure_logging()


def register_errors_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValidationError)
    def handle_pydantic_validation_error(
        request: Request,
        exc: ValidationError,
    ) -> JSONResponse:
        log.error(
            "VALIDATION ERROR!!!",
            exc_info=exc,
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={}
        )

    @app.exception_handler(DatabaseError)
    def handle_db_error(
        request: Request,
        exc: DatabaseError,
    ) -> JSONResponse:
        log.error(
            "DATABASE ERROR!!! ",
            exc_info=exc,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={}
        )

    @app.exception_handler(500)
    def handle_pydantic_validation_error(
            request: Request,
            exc: Any,
    ) -> JSONResponse:
        log.error(
            "UNKNOW ERROR!!! ",
            exc_info=exc,
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={}
        )