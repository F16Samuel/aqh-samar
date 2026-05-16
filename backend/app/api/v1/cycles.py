from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.cycle import Cycle
from app.schemas.cycle import CycleCreate, CycleUpdate, CycleOut

router = APIRouter()

@router.get("/active")
@require_roles("employee", "manager", "admin")
async def get_active_cycle(request: Request, db: AsyncSession = Depends(get_db)):
    """Fetch the currently active cycle."""
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        return err("NOT_FOUND", "No active cycle found", 404)
        
    return ok(CycleOut.model_validate(cycle).model_dump(mode="json"))

@router.get("/")
@require_roles("admin")
async def list_cycles(request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: list all cycles."""
    result = await db.execute(select(Cycle).order_by(Cycle.year.desc(), Cycle.window_open.desc()))
    cycles = result.scalars().all()
    return ok([CycleOut.model_validate(c).model_dump(mode="json") for c in cycles])

@router.post("/")
@require_roles("admin")
async def create_cycle(payload: CycleCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: create a new cycle."""
    if payload.is_active:
        # Deactivate all others first
        await db.execute(update(Cycle).values(is_active=False))
        
    new_cycle = Cycle(**payload.model_dump())
    db.add(new_cycle)
    await db.commit()
    await db.refresh(new_cycle)
    
    return ok(CycleOut.model_validate(new_cycle).model_dump(mode="json"), 201)

@router.patch("/{cycle_id}")
@require_roles("admin")
async def update_cycle(cycle_id: UUID, payload: CycleUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: update an existing cycle."""
    result = await db.execute(select(Cycle).where(Cycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    
    if not cycle:
        return err("NOT_FOUND", "Cycle not found", 404)
        
    update_data = payload.model_dump(exclude_unset=True)
    
    if update_data.get("is_active"):
        # Deactivate all others first
        await db.execute(update(Cycle).where(Cycle.id != cycle_id).values(is_active=False))
        
    for key, value in update_data.items():
        setattr(cycle, key, value)
        
    await db.commit()
    await db.refresh(cycle)
    
    return ok(CycleOut.model_validate(cycle).model_dump(mode="json"))
