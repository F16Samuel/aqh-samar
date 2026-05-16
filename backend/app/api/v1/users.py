from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, Request

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.department import Department
from app.schemas.user import UserOut, UserUpdate, UserCreate

router = APIRouter()

@router.get("/departments")
@require_roles("admin")
async def list_departments(request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: list all departments for hierarchy management."""
    result = await db.execute(select(Department).order_by(Department.name))
    depts = result.scalars().all()
    return ok([{"id": str(d.id), "name": d.name} for d in depts])

@router.post("/profiles")
@require_roles("admin")
async def create_user_profile(payload: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Create a user profile and provision them in Supabase Auth.
    If the user already exists in Supabase, we link to their existing ID.
    """
    from app.lib.supabase import get_supabase_admin_client
    supabase = get_supabase_admin_client()
    
    # 1. Check if user exists in Supabase or create them
    # We use admin.create_user which doesn't require email confirmation if configured
    try:
        # Check if user already exists in our DB to avoid duplicates
        existing_db_user = await db.execute(select(User).where(User.email == payload.email))
        if existing_db_user.scalar_one_or_none():
            return err("ALREADY_EXISTS", "A user with this email already exists in the portal.", 400)

        # Provision in Supabase Auth
        # Note: In production, you might want to generate a random password and send it via email
        # For this portal, we'll create them so they can use "Forgot Password" or SSO
        res = supabase.auth.admin.create_user({
            "email": payload.email,
            "user_metadata": {"full_name": payload.full_name},
            "email_confirm": True
        })
        
        supabase_id = res.user.id
    except Exception as e:
        # If user already exists in Supabase, try to get their ID
        try:
            # This is a bit of a hack since there's no direct "get user by email" in the admin client easily
            # but we can list users and filter or try to sign up and catch the error
            # For brevity and "hackathon finalist" quality, we'll try to list
            users_res = supabase.auth.admin.list_users()
            matching_user = next((u for u in users_res if u.email == payload.email), None)
            if matching_user:
                supabase_id = matching_user.id
            else:
                return err("PROVISIONING_FAILED", f"Could not create user in Supabase: {str(e)}", 400)
        except Exception:
            return err("PROVISIONING_FAILED", f"Supabase Auth error: {str(e)}", 400)

    # 2. Create local profile linked to Supabase ID
    new_user = User(
        id=supabase_id,
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        department_id=payload.department_id,
        manager_id=payload.manager_id
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except Exception as e:
        await db.rollback()
        return err("CREATE_FAILED", f"Database error: {str(e)}", 400)
        
    return ok(UserOut.model_validate(new_user).model_dump(mode="json"), 201)

@router.get("/me")
@require_roles("employee", "manager", "admin")
async def get_current_user(request: Request):
    """Get the profile of the currently authenticated user."""
    user = request.state.user
    return ok(UserOut.model_validate(user).model_dump(mode="json"))

@router.get("/")
@require_roles("admin", "manager")
async def list_users(request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: list all users."""
    from sqlalchemy.orm import aliased
    Manager = aliased(User)
    
    result = await db.execute(
        select(User, Department, Manager)
        .outerjoin(Department, User.department_id == Department.id)
        .outerjoin(Manager, User.manager_id == Manager.id)
        .order_by(User.full_name)
    )
    
    results = []
    for u, d, m in result.all():
        out = UserOut.model_validate(u)
        out.department_name = d.name if d else None
        out.manager_name = m.full_name if m else None
        results.append(out.model_dump(mode="json"))
    return ok(results)

@router.get("/{user_id}")
@require_roles("employee", "manager", "admin")
async def get_user(user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Get user by ID. Accessible by self, direct manager, or admin."""
    curr_user = request.state.user
    
    from sqlalchemy.orm import aliased
    Manager = aliased(User)
    result = await db.execute(
        select(User, Department, Manager)
        .outerjoin(Department, User.department_id == Department.id)
        .outerjoin(Manager, User.manager_id == Manager.id)
        .where(User.id == user_id)
    )
    row = result.first()
    if not row:
        return err("NOT_FOUND", "User not found", 404)
        
    target_user, d, m = row
        
    if curr_user.role != "admin" and curr_user.id != user_id and target_user.manager_id != curr_user.id:
        return err("FORBIDDEN", "You do not have permission to view this user", 403)
        
    out = UserOut.model_validate(target_user)
    out.department_name = d.name if d else None
    out.manager_name = m.full_name if m else None
    return ok(out.model_dump(mode="json"))

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

@router.patch("/{user_id}")
@require_roles("admin")
async def update_user(user_id: UUID, payload: UserUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: update user role, manager, or department."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        return err("NOT_FOUND", "User not found", 404)
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return ok(UserOut.model_validate(user).model_dump(mode="json"))
