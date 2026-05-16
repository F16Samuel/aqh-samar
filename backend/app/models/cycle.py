import uuid
from datetime import date

from sqlalchemy import Column, String, Integer, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Cycle(Base):
    __tablename__ = "cycles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    year = Column(Integer, nullable=False)
    phase = Column(String, nullable=False) # e.g. "Phase 1 - Goal Setting", "Q1 Check-in", "Q2 Check-in", "Q3 Check-in", "Q4 / Annual"
    window_open = Column(Date, nullable=False)
    window_close = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)

    # Relationships
    goal_sheets = relationship("GoalSheet", back_populates="cycle")
    achievements = relationship("Achievement", back_populates="cycle")
