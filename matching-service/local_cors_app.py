"""Loopback Vite-origin CORS wrapper for the local matching API."""

from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from api import app as matching_api


VITE_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


def wrap_for_vite(app: ASGIApp) -> CORSMiddleware:
    return CORSMiddleware(
        app=app,
        allow_origins=list(VITE_ORIGINS),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
        max_age=600,
    )


app = wrap_for_vite(matching_api)
