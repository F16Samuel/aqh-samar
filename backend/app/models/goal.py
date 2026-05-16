import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class GoalSheet(Base):
    __tablename__ = "goal_sheets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("cycles.id"), nullable=False)
    status = Column(String, nullable=False, default="draft") # draft, submitted, approved, rework
    
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    employee = relationship("User", foreign_keys=[employee_id], back_populates="goal_sheets")
    approved_by_user = relationship("User", foreign_keys=[approved_by], back_populates="approved_goal_sheets")
    cycle = relationship("Cycle", back_populates="goal_sheets")
    
    goals = relationship("Goal", back_populates="sheet", cascade="all, delete-orphan")
    checkins = relationship("CheckIn", back_populates="sheet", cascade="all, delete-orphan")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
    shared_from = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=True)
    
    thrust_area = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    uom_type = Column(String, nullable=False) # min, max, timeline, zero
    target = Column(String, nullable=False)
    weightage = Column(Integer, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)

    # Relationships
    sheet = relationship("GoalSheet", back_populates="goals")
    achievements = relationship("Achievement", back_populates="goal", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="goal", cascade="all, delete-orphan")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), ForeignKey("cycles.id"), nullable=False)
    quarter = Column(String, nullable=False) # Q1, Q2, Q3, Q4
    
    actual = Column(String, nullable=True)
    status = Column(String, nullable=False, default="not_started") # not_started, on_track, completed
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    goal = relationship("Goal", back_populates="achievements")
    cycle = relationship("Cycle", back_populates="achievements")


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=False)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quarter = Column(String, nullable=False) # Q1, Q2, Q3, Q4
    
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    sheet = relationship("GoalSheet", back_populates="checkins")
    manager = relationship("User", back_populates="checkins")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    field_name = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    goal = relationship("Goal", back_populates="audit_logs")
    changed_by_user = relationship("User", back_populates="audit_logs")
