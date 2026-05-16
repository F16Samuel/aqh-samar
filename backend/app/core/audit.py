import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.goal import AuditLog

async def write_audit_log(
    session: AsyncSession,
    goal_id: uuid.UUID,
    changed_by: uuid.UUID,
    field_name: str,
    old_value: str,
    new_value: str,
) -> None:
    audit = AuditLog(
        goal_id=goal_id,
        changed_by=changed_by,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        changed_at=datetime.utcnow(),
    )
    session.add(audit)
    await session.commit()
