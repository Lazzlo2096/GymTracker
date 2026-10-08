"""Схемы push-токенов."""

from typing import Literal

from pydantic import BaseModel, Field


class PushTokenRegister(BaseModel):
    expo_push_token: str = Field(..., min_length=10, max_length=256)
    platform: Literal["ios", "android", "web"] = "android"


class PushTokenUnregister(BaseModel):
    expo_push_token: str = Field(..., min_length=10, max_length=256)


class PushTokenResponse(BaseModel):
    status: Literal["registered", "removed"] = "registered"
