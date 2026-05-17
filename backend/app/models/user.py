import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False) # legacy 'role' column (VARCHAR)
    
    # New platform_role column (strict PostgreSQL ENUM)
    platform_role = Column(
        Enum("employee", "manager", "admin", name="user_platform_role"), 
        nullable=False, 
        default="employee"
    )
    job_title = Column(String, nullable=True)
    
    # Corporate metadata fields
    is_active = Column(Boolean, default=True, nullable=False)
    employment_type = Column(String, nullable=True) # e.g. Full-time, Contractor
    employee_code = Column(String, nullable=True) # e.g. EMP-10342
    location = Column(String, nullable=True) # e.g. SF, NYC, Remote
    
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)

    def __init__(self, **kwargs):
        # Sync role and platform_role fields upon object creation
        if "role" in kwargs and "platform_role" not in kwargs:
            kwargs["platform_role"] = kwargs["role"]
        elif "platform_role" in kwargs and "role" not in kwargs:
            kwargs["role"] = kwargs["platform_role"]
        super().__init__(**kwargs)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    department = relationship("Department", back_populates="users")
    manager = relationship("User", remote_side=[id], backref="direct_reports")
    
    # Relationships to goal sheets
    goal_sheets = relationship("GoalSheet", back_populates="employee", foreign_keys="GoalSheet.employee_id")
    approved_goal_sheets = relationship("GoalSheet", back_populates="approved_by_user", foreign_keys="GoalSheet.approved_by")
    
    # Relationships to checkins
    checkins = relationship("CheckIn", back_populates="manager")
    
    # Relationships to audit logs
    audit_logs = relationship("AuditLog", back_populates="changed_by_user")

from sqlalchemy import event

@event.listens_for(User, 'before_insert')
def receive_before_insert(mapper, connection, target):
    if target.role and not target.platform_role:
        target.platform_role = target.role
    elif target.platform_role and not target.role:
        target.role = target.platform_role

@event.listens_for(User, 'before_update')
def receive_before_update(mapper, connection, target):
    # Detect state changes and sync
    from sqlalchemy.orm.attributes import get_history
    role_hist = get_history(target, 'role')
    platform_role_hist = get_history(target, 'platform_role')
    
    if platform_role_hist.has_changes():
        target.role = target.platform_role
    elif role_hist.has_changes():
        target.platform_role = target.role

