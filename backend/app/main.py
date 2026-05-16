from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.middleware import AuthMiddleware
# ── Router imports (uncomment as phases complete) ───────────────────────────
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.cycles import router as cycles_router
# from app.api.v1.goal_sheets import router as sheets_router
# from app.api.v1.goals import router as goals_router
# from app.api.v1.achievements import router as achievements_router
# from app.api.v1.checkins import router as checkins_router
# from app.api.v1.reports import router as reports_router
# from app.api.v1.admin import router as admin_router

app = FastAPI(
    title="AQH-SAMAR — Goal Setting & Tracking Portal",
    description="In-House Employee Performance Management System API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth Middleware ───────────────────────────────────────────────────────────
app.add_middleware(AuthMiddleware)

# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


# ── Register routers (uncomment as phases complete) ───────────────────────────
API_V1 = "/api/v1"
app.include_router(auth_router, prefix=f"{API_V1}/auth", tags=["Auth"])
app.include_router(users_router, prefix=f"{API_V1}/users", tags=["Users"])
app.include_router(cycles_router, prefix=f"{API_V1}/cycles", tags=["Cycles"])
# app.include_router(sheets_router, prefix=f"{API_V1}/goal-sheets", tags=["Goal Sheets"])
# app.include_router(goals_router, prefix=f"{API_V1}/goals", tags=["Goals"])
# app.include_router(achievements_router, prefix=f"{API_V1}/achievements", tags=["Achievements"])
# app.include_router(checkins_router, prefix=f"{API_V1}/checkins", tags=["Check-ins"])
# app.include_router(reports_router, prefix=f"{API_V1}/reports", tags=["Reports"])
# app.include_router(admin_router, prefix=f"{API_V1}/admin", tags=["Admin"])
