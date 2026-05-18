import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base

class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    trigger_type = Column(String, nullable=False)  # overdue_submission, pending_approval, low_completion, missing_checkin, inactivity, declining_performance
    
    conditions = Column(JSONB, nullable=False, default=dict)  # e.g., {"days_overdue": 5, "threshold_percent": 50}
    actions = Column(JSONB, nullable=False, default=list)  # sequential array of steps: [{"delay_days": 0, "type": "email", "recipient": "employee"}, {"delay_days": 3, "type": "manager_escalation"}]
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tasks = relationship("EscalationTask", back_populates="rule", cascade="all, delete-orphan")
    history = relationship("EscalationHistory", back_populates="rule", cascade="all, delete-orphan")


class EscalationTask(Base):
    __tablename__ = "escalation_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("automation_rules.id"), nullable=False)
    goal_sheet_id = Column(UUID(as_uuid=True), ForeignKey("goal_sheets.id"), nullable=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    current_step_index = Column(Integer, default=0, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, running, completed, breached, cancelled
    sla_deadline = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    next_run_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    rule = relationship("AutomationRule", back_populates="tasks")
    goal_sheet = relationship("GoalSheet")
    employee = relationship("User")
    history_entries = relationship("EscalationHistory", back_populates="task", cascade="all, delete-orphan")


class EscalationHistory(Base):
    __tablename__ = "escalation_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("escalation_tasks.id", ondelete="SET NULL"), nullable=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("automation_rules.id"), nullable=False)
    
    action_type = Column(String, nullable=False)  # email, teams, manager_escalation, hr_escalation, workflow_reassignment
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String, nullable=False)  # success, failed
    details = Column(Text, nullable=True)
    executed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("EscalationTask", back_populates="history_entries")
    rule = relationship("AutomationRule", back_populates="history")
    recipient = relationship("User")


class MockNotification(Base):
    __tablename__ = "mock_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String, nullable=False)  # email, teams
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    sender_name = Column(String, nullable=False, default="System Automator")
    
    subject = Column(String, nullable=True)  # Used for emails
    body = Column(Text, nullable=False)  # HTML for emails, JSON String for Teams adaptive cards
    status = Column(String, default="unread", nullable=False)  # unread, read, dismissed
    folder = Column(String, default="inbox", nullable=False)  # inbox, sent, junk, deleted
    
    interactive_payload = Column(JSONB, nullable=True)  # Dynamic actionable properties (e.g. {"sheet_id": "...", "action": "approve"})
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    recipient = relationship("User", foreign_keys=[recipient_id])
    sender = relationship("User", foreign_keys=[sender_id])
