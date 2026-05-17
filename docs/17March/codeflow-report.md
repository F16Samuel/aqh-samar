# CodeFlow Analysis Report

**Repository:** Local Folder
**Analyzed:** 5/17/2026, 1:16:41 PM

## Summary

| Metric | Value |
|--------|-------|
| Health Score | 100/100 (A) |
| Files | 66 |
| Functions | 133 |
| Lines of Code | 8,815 |
| Dependencies | 167 |
| Unused Functions | 0 |
| Security Issues | 0 |

## Design Patterns

### Django Signals
Django signals for decoupled event-driven communication between components.

**Files:** `env.py`, `dump_supabase.py`

### Middleware
Request/response middleware for cross-cutting concerns (auth, logging, CORS).

**Files:** `middleware.py`

## Anti-Patterns

### Long File
Files over 500 lines are harder to maintain. Consider breaking into smaller modules.

**Affected files:** `reports.py`, `wipe_and_seed.py`

## Architecture Issues

### 10 Highly Coupled
Files imported by 8+ others

**Affected:** `goal_sheets.py (18 imports)`, `goals.py (16 imports)`, `achievements.py (15 imports)`, `reports.py (14 imports)`, `checkins.py (12 imports)`

### 5 Similar Code Blocks
Copy-paste code detected

**Affected:** `upgrade, downgrade, Settings._parse_cors, write_audit_log, notify_manager, Base, receive_before_insert, AchievementBase, AchievementCreate, AchievementUpdate, AuditLogBase, CycleBase, CycleUpdate, GoalSharedCreate, GoalSheetCreate, CompletionSummaryResponse`, `create_achievement, create_checkin, Goal`, `create_goal, update_goal, delete_goal, update_cycle, get_audit_logs, submit_sheet, CheckIn`, `login, get_me, get_score, get_current_user`, `refresh, logout, department_report, get_completion_report, ok, err, require_roles, get_db, AchievementOut, AuditLogOut, DepartmentOut, CycleOut, GoalOut, CheckInOut, UserOut`

### 48 Architecture Violations
Lower layers importing from higher layers

**Affected:** `utils → services`, `utils → services`, `utils → services`, `utils → services`, `utils → services`

### 5 High Complexity Files
Files with complexity score >30

**Affected:** `reports.py (241)`, `wipe_and_seed.py (63)`, `goals.py (52)`, `dump_supabase.py (45)`, `goal_sheets.py (35)`

## File Details

| File | Folder | Layer | Lines | Functions |
|------|--------|-------|-------|----------|
| `20260516_0751_bd1b52ea0a32_initial_migration.py` | alembic/versions | utils | 131 | 2 |
| `20260516_1040_96a206191774_initial.py` | alembic/versions | utils | 33 | 2 |
| `env.py` | alembic | utils | 64 | 2 |
| `achievements.py` | app/api/v1 | services | 183 | 4 |
| `admin.py` | app/api/v1 | services | 103 | 3 |
| `goals.py` | app/api/v1 | services | 280 | 6 |
| `auth.py` | app/api/v1 | services | 35 | 4 |
| `cycles.py` | app/api/v1 | services | 73 | 4 |
| `reports.py` | app/api/v1 | services | 785 | 13 |
| `__init__.py` | app/api/v1 | services | 2 | 0 |
| `users.py` | app/api/v1 | services | 137 | 7 |
| `checkins.py` | app/api/v1 | services | 64 | 2 |
| `goal_sheets.py` | app/api/v1 | services | 294 | 7 |
| `__init__.py` | app/api | services | 2 | 0 |
| `config.py` | app/core | config | 46 | 3 |
| `responses.py` | app/core | utils | 24 | 2 |
| `utils.py` | app/core | utils | 71 | 2 |
| `audit.py` | app/core | utils | 24 | 1 |
| `middleware.py` | app/core | services | 108 | 5 |
| `__init__.py` | app/core | utils | 2 | 0 |
| `notifications.py` | app/core | utils | 12 | 1 |
| `validators.py` | app/core | utils | 27 | 2 |
| `security.py` | app/core | utils | 38 | 3 |
| `base.py` | app/db | utils | 7 | 1 |
| `__init__.py` | app/db | utils | 2 | 0 |
| `base_all.py` | app/db | utils | 8 | 0 |
| `session.py` | app/db | utils | 26 | 1 |
| `user.py` | app/models | data | 81 | 4 |
| `__init__.py` | app/models | data | 2 | 0 |
| `goal.py` | app/models | data | 106 | 5 |
| `cycle.py` | app/models | data | 24 | 1 |
| `department.py` | app/models | data | 19 | 1 |
| `achievement.py` | app/schemas | data | 29 | 4 |
| `audit_log.py` | app/schemas | data | 21 | 3 |
| `department.py` | app/schemas | data | 14 | 3 |
| `cycle.py` | app/schemas | data | 32 | 4 |
| `goal.py` | app/schemas | data | 53 | 6 |
| `goal_sheet.py` | app/schemas | data | 32 | 4 |
| `__init__.py` | app/schemas | data | 2 | 0 |
| `checkin.py` | app/schemas | data | 19 | 3 |
| `user.py` | app/schemas | data | 40 | 4 |
| `reports.py` | app/schemas | data | 14 | 1 |
| `__init__.py` | app/services | services | 2 | 0 |
| `__init__.py` | app | utils | 2 | 0 |
| `main.py` | app | utils | 100 | 3 |
| `achievements.json` | docs/supabase_dump | utils | 1838 | 0 |
| `audit_logs.json` | docs/supabase_dump | utils | 11 | 0 |
| `checkins.json` | docs/supabase_dump | utils | 650 | 0 |
| `cycles.json` | docs/supabase_dump | utils | 18 | 0 |
| `departments.json` | docs/supabase_dump | utils | 38 | 0 |
| `goals.json` | docs/supabase_dump | utils | 794 | 0 |
| `users.json` | docs/supabase_dump | utils | 392 | 0 |
| `goal_sheets.json` | docs/supabase_dump | utils | 326 | 0 |
| `dump_supabase.py` | scripts | utils | 191 | 3 |
| `dump_v2.py` | scripts | utils | 74 | 1 |
| `seed.py` | scripts | utils | 140 | 1 |
| `test_ach.py` | scripts | test | 26 | 1 |
| `wipe_and_seed.py` | scripts | utils | 644 | 1 |
| `run_patch.py` | scripts | utils | 55 | 1 |
| `populate_db.py` | scripts | utils | 140 | 1 |
| `test_api.py` | scripts | test | 39 | 1 |
| `.env` | root | utils | 48 | 0 |
| `alembic.ini` | root | utils | 102 | 0 |
| `pyproject.toml` | root | utils | 65 | 0 |
| `schema_patch.sql` | root | utils | 36 | 0 |
| `requirements.txt` | root | utils | 15 | 0 |
