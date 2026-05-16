# Import all models here so Alembic autogenerate can discover them.
from app.db.base import Base  # noqa: F401

from app.models.department import Department  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.cycle import Cycle  # noqa: F401
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn, AuditLog  # noqa: F401
