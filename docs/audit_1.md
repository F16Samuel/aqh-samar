━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE-BY-PHASE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 0 — Repo & tooling setup
  Status: COMPLETE
  Missing files: 
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 1 — Database & migrations
  Status: COMPLETE
  Missing files:
    - None
  Incomplete implementations:
    - `backend/app/db/base.py`
      `class Base(DeclarativeBase):`
      `    pass` (Missing any common base model logic if intended, though standard for SQLAlchemy).
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 2 — Auth middleware
  Status: COMPLETE
  Missing files:
    - None
  Incomplete implementations:
    - `backend/app/core/middleware.py`
      `except JWTError:`
      `    pass` (Silently ignores JWT errors instead of explicitly aborting or logging).
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 3 — Cycles & user management
  Status: PARTIAL
  Missing files:
    - None
  Incomplete implementations:
    - `backend/app/core/utils.py`
      `if action_type:`
      `    pass` (Cycle window helper is stubbed for phase-specific action logic).
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 4 — Goal sheet lifecycle
  Status: PARTIAL
  Missing files:
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - "Audit log entry on every post-lock change" — Not enforced. Changes to locked goals (or admin overrides) do not consistently write to the `audit_logs` table (only admin unlock does).
    - "Weightage validator (run before every goal write)" — Not enforced. Missing validation on `POST /goals` and `PATCH /goals` to ensure total weightage does not exceed 100%.
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 5 — Goals CRUD & shared goals
  Status: PARTIAL
  Missing files:
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - "Weightage validator (run before every goal write)" — Neither `POST` nor `PATCH` enforce weightage limits or check if the sum equals 100%.
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 6 — Achievements & check-ins
  Status: PARTIAL
  Missing files:
    - `backend/app/core/middleware.py` (Missing the actual Window Guard middleware implementation).
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - "Window guard middleware: reject writes outside cycle.window_open–window_close" — Not enforced on `POST /achievements` or `PATCH /achievements`.
  Missing schemas:
    - None
  Missing wiring:
    - `is_window_open` is defined in `utils.py` but never registered as a dependency or middleware in the app routers.

PHASE 7 — Reports & audit
  Status: PARTIAL
  Missing files:
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - `GET /reports/achievement` (streaming CSV/Excel)
    - `GET /reports/completion` (JSON summary done vs pending check-ins)
  Missing business rules:
    - None
  Missing schemas:
    - Missing response schemas for the `/reports/completion` summary.
  Missing wiring:
    - None

PHASE 8 — Frontend integration
  Status: PARTIAL
  Missing files:
    - None
  Incomplete implementations:
    - `frontend/src/pages/employee/MyGoalsPage.tsx`
      `const addGoal = async (e: React.FormEvent) => { ... }`
      Missing live weightage validator logic. It allows submitting a new goal even if adding its weightage pushes the total above 100%.
      Missing React Query implementation. Uses raw `useEffect` and `api.get` instead of `@tanstack/react-query`.
  Missing endpoints:
    - None
  Missing business rules:
    - "Weightage validator live in the form (mirrors backend rules)" — Not fully mirroring backend rules or preventing over-allocation.
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 9 — Deployment
  Status: COMPLETE
  Missing files:
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

PHASE 10 — Polish & demo prep
  Status: COMPLETE
  Missing files:
    - None
  Incomplete implementations:
    - None
  Missing endpoints:
    - None
  Missing business rules:
    - None
  Missing schemas:
    - None
  Missing wiring:
    - None

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-CUTTING GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Consistent error response shape { data, error: { code, message } } — Applied in `responses.py` (`ok`, `err`), but missing globally for standard FastAPI `RequestValidationError` (422s are not overridden in `main.py`).
- Async SQLAlchemy throughout — Applied (all queries use `await db.execute`).
- All config via environment variables — Applied (`config.py`), but `SECRET_KEY` has a hardcoded default `"change-me"`.
- Audit logging helper `write_audit_log` — Missing entirely.
- `notify_manager()` stub — Missing entirely.
- Weightage validator — Missing (Not implemented as a dependency or middleware, missing on goal write endpoints).
- Cycle window guard — Missing (Defined as a utility but not applied in routes or middleware).
- Role guard decorator — Applied (`@require_roles` is used comprehensively).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSING TESTS (manual checkpoints)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- PHASE 1: PASSABLE
- PHASE 2: PASSABLE
- PHASE 3: PASSABLE
- PHASE 4: PASSABLE
- PHASE 5: PASSABLE
- PHASE 6: BLOCKED (Trying to log outside the window will not return a 422 because the window guard middleware is not applied).
- PHASE 7: BLOCKED (Download achievement report fails because `GET /reports/achievement` is missing; completion dashboard fails because `GET /reports/completion` is missing).
- PHASE 8: PASSABLE
- PHASE 9: PASSABLE
- PHASE 10: PASSABLE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORITY ORDER TO FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [PHASE 7] backend/app/api/v1/reports.py — `GET /reports/achievement` and `GET /reports/completion` are missing — Blocks Phase 7 manual test checkpoint.
  [PHASE 6] backend/app/api/v1/achievements.py — Cycle window guard not applied — Blocks Phase 6 manual test checkpoint.
  [PHASE 4] backend/app/api/v1/goals.py — Weightage validator not enforced before every goal write — Breaks core validation business rule.
  [PHASE 4] backend/app/api/v1/goals.py — Audit log entry on every post-lock change is missing — Breaks compliance and audit trail requirements.
  [PHASE 8] frontend/src/pages/employee/MyGoalsPage.tsx — Live weightage validator allows exceeding 100% on add; React Query not utilized — Violates frontend integration requirements.
  [PHASE 0] backend/app/main.py — RequestValidationError override missing — Inconsistent API responses for validation errors.
  [CROSS] backend/app/core/utils.py — `write_audit_log` and `notify_manager()` stubs missing — Needed for cross-cutting logic execution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY COUNTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Phases complete:         5 / 10
  Files missing:           1
  Files incomplete:        4
  Endpoints missing:       2
  Business rules missing:  4
  Schemas missing:         1
  Wiring gaps:             1
  Manual tests passable:   8 / 10