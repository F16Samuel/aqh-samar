import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False) # 'employee', 'manager', 'admin'
    
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    
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
