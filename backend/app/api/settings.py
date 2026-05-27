"""Settings API — persistent user/app preferences."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core import memory as store

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingPut(BaseModel):
    key: str
    value: str


@router.get("")
def get_all() -> dict:
    return store.all_settings()


@router.put("")
def put(body: SettingPut) -> dict:
    store.set_setting(body.key, body.value)
    return {"key": body.key, "value": body.value}


@router.get("/{key}")
def get_one(key: str, default: str | None = None) -> dict:
    return {"key": key, "value": store.get_setting(key, default)}
