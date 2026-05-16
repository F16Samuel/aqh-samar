from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, Request

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter()

@router.get("/me")
@require_roles("employee", "manager", "admin")
async def get_current_user(request: Request):
    """Get the profile of the currently authenticated user."""
    user = request.state.user
    return ok(UserOut.model_validate(user).model_dump(mode="json"))

@router.get("/")
@require_roles("admin")
async def list_users(db: AsyncSession = Depends(get_db)):
    """Admin: list all users."""
    result = await db.execute(select(User).order_by(User.full_name))
    users = result.scalars().all()
    return ok([UserOut.model_validate(u).model_dump(mode="json") for u in users])

@router.get("/{user_id}")
@require_roles("employee", "manager", "admin")
async def get_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Get user by ID. Accessible by self, direct manager, or admin."""
    curr_user = request.state.user
    
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        return err("NOT_FOUND", "User not found", 404)
        
    if curr_user.role != "admin" and curr_user.id != user_id and target_user.manager_id != curr_user.id:
        return err("FORBIDDEN", "You do not have permission to view this user", 403)
        
    return ok(UserOut.model_validate(target_user).model_dump(mode="json"))

@router.get("/{user_id}/team")
@require_roles("manager", "admin")
async def get_team(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Get direct reports of a manager."""
    curr_user = request.state.user
    
    if curr_user.role != "admin" and curr_user.id != user_id:
        return err("FORBIDDEN", "You can only view your own team", 403)
        
    result = await db.execute(select(User).where(User.manager_id == user_id).order_by(User.full_name))
    team = result.scalars().all()
    
    return ok([UserOut.model_validate(u).model_dump(mode="json") for u in team])
