from fastapi import APIRouter, Request

from app.core.responses import ok
from app.core.security import require_roles
from app.schemas.user import UserOut

router = APIRouter()

@router.get("/me")
@require_roles("employee", "manager", "admin")
async def get_current_user(request: Request):
    """Get the profile of the currently authenticated user."""
    user = request.state.user
    return ok(UserOut.model_validate(user).model_dump(mode="json"))
