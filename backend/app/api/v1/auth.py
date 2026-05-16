from fastapi import APIRouter, Request

from app.core.responses import ok
from app.core.security import require_roles
from app.schemas.user import UserOut

router = APIRouter()

@router.post("/login")
@require_roles("employee", "manager", "admin")
async def login(request: Request):
    """
    Exchange Supabase token for user profile.
    The frontend authenticates via Supabase client and passes the JWT.
    AuthMiddleware decodes it and attaches request.state.user.
    """
    user = request.state.user
    return ok(UserOut.model_validate(user).model_dump(mode="json"))

@router.post("/refresh")
async def refresh():
    """Client handles refresh natively via Supabase JS."""
    return ok({"message": "handled by supabase client"})

@router.post("/logout")
async def logout():
    """Client handles logout natively via Supabase JS."""
    return ok({"message": "handled by supabase client"})

@router.get("/me")
@require_roles("employee", "manager", "admin")
async def get_me(request: Request):
    user = request.state.user
    return ok(UserOut.model_validate(user).model_dump(mode="json"))
