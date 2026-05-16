"""
Consistent JSON response helpers.

Every endpoint returns one of:
  { "data": <payload>, "error": null }
  { "data": null, "error": { "code": "<CODE>", "message": "<text>" } }
"""
from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse


def ok(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"data": data, "error": None})


def err(code: str, message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"data": None, "error": {"code": code, "message": message}},
    )
