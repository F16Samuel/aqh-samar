You are a senior full-stack engineer helping build a production-ready Goal Setting & Tracking Portal for a hackathon. Work through this project in strict phases. At each commit checkpoint, output the exact git commit message to use. At each test checkpoint, list exactly what to manually verify before proceeding. Cross check once with prblm.docx and also prd.docx, we need to score perfectly against the prblm.docx evaluation metrics all docs go in docs/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The portal is an in-house employee performance management system with three roles: Employee, Manager (L1), and Admin/HR.

Core feature set (all must-have):
- Goal Sheet creation with thrust areas, UoM types (Numeric, %, Timeline, Zero), targets and weightage
- Validation: total weightage = 100%, min 10% per goal, max 8 goals per employee
- Manager approval workflow: review → inline edit → approve (locks goals) or return for rework
- Shared Goals: admin pushes a KPI to multiple employees; recipients adjust weightage only; achievements sync from primary owner
- Quarterly achievement logging (Q1/Q2/Q3/Q4) with status: Not Started / On Track / Completed
- Manager check-in module with structured comments per quarter
- System-computed progress scores per UoM:
    Min (Numeric/%): Achievement ÷ Target
    Max (Numeric/%): Target ÷ Achievement  
    Timeline: Completion date vs Deadline
    Zero: If 0 → 100%, else 0%
- Cycle-enforced check-in windows (Phase 1 opens May 1; Q1=July; Q2=Oct; Q3=Jan; Q4=Mar/Apr)
- Achievement Report (CSV/Excel export), Completion Dashboard, Audit Trail (post-lock changes only)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECH STACK & DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend:  FastAPI (Python 3.11+), deployed as a monolith on Railway
Frontend: Vite + React (TypeScript), deployed on Vercel
Database: PostgreSQL on Supabase (use Supabase Auth for JWT; validate tokens in FastAPI middleware)
ORM:      SQLAlchemy 2.0 (async) + Alembic for migrations
Auth:     Supabase Auth (JWTs) — FastAPI reads and validates the JWT, does NOT issue its own tokens

Monorepo layout:
  /backend    → FastAPI app
  /frontend   → Vite + React app
  railway.json and vercel.json at root

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tables and key columns:

users           id, email, full_name, role (employee|manager|admin), manager_id (self-FK), department_id, created_at
departments     id, name
cycles          id, year, phase, window_open, window_close, is_active
goal_sheets     id, employee_id→users, cycle_id→cycles, status (draft|submitted|approved|rework), submitted_at, approved_at, approved_by→users
goals           id, sheet_id→goal_sheets, shared_from→goals (nullable), thrust_area, title, description, uom_type (min|max|timeline|zero), target, weightage, is_locked
achievements    id, goal_id→goals, cycle_id→cycles, quarter (Q1|Q2|Q3|Q4), actual, status (not_started|on_track|completed), updated_at
checkins        id, sheet_id→goal_sheets, manager_id→users, quarter, comment, created_at
audit_logs      id, goal_id→goals, changed_by→users, field_name, old_value, new_value, changed_at

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API ROUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/auth         POST /login, POST /refresh, POST /logout
/users        GET /me, GET / (admin), GET /{id}, GET /{id}/team
/cycles       GET /active, GET / (admin), POST / (admin), PATCH /{id}
/goal-sheets  POST /, GET /mine, GET /team, GET /{id},
              POST /{id}/submit, POST /{id}/approve, POST /{id}/return
/goals        POST /, PATCH /{id}, DELETE /{id}, POST /shared
/achievements POST /, PATCH /{id}
/checkins     POST /, GET /sheet/{sheet_id}
/reports      GET /achievement, GET /completion, GET /audit/{goal_id}
/admin        POST /unlock/{goal_id}, GET /escalations

Middleware: JWT decode → request.state.user, role guard decorator, cycle window validator, weightage validator (run before every goal write)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUILD PHASES — work through these in order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 0 — Repo & tooling setup
  - Init monorepo, .gitignore, README skeleton
  - /backend: FastAPI skeleton, pyproject.toml, requirements.txt
  - /frontend: vite + react-ts scaffold
  - railway.json, vercel.json stubs
  - .env.example with all required vars documented
  ► COMMIT: "chore: init monorepo with FastAPI and Vite scaffolds"

PHASE 1 — Database & migrations
  - SQLAlchemy async engine + session factory
  - All models (users, departments, cycles, goal_sheets, goals, achievements, checkins, audit_logs)
  - Alembic init + first migration (create all tables)
  - Seed script: 1 admin, 2 managers, 4 employees, 1 active cycle, sample departments
  ► COMMIT: "feat: database models and initial migration"
  ✦ TEST: run seed script, open Supabase table editor, confirm all rows present and FK relationships intact

PHASE 2 — Auth middleware
  - Supabase JWT validation middleware (decode + attach request.state.user)
  - Role guard decorator: @require_roles(*roles)
  - /auth/login (exchange Supabase token for user profile), /auth/me
  - /users/me endpoint
  ► COMMIT: "feat: JWT auth middleware and role guards"
  ✦ TEST: use Postman/httpie — hit /users/me with valid token → 200 with profile; with no token → 401; with wrong role on protected route → 403

PHASE 3 — Cycles & user management
  - Full /cycles router (CRUD, admin-only writes)
  - Full /users router (GET /me, /team, admin list)
  - Cycle window helper: is_window_open(cycle, action_type) → bool
  ► COMMIT: "feat: cycles and user management endpoints"
  ✦ TEST: create a cycle via POST /cycles as admin; confirm non-admin gets 403; fetch /cycles/active; hit /users/{id}/team as a manager and verify only their direct reports returned

PHASE 4 — Goal sheet lifecycle
  - POST /goal-sheets (employee, creates draft for active cycle)
  - GET /mine, GET /team, GET /{id}
  - POST /{id}/submit with weightage validator (must sum to 100%, each ≥10%, ≤8 goals)
  - POST /{id}/approve (manager only, locks all goals on the sheet)
  - POST /{id}/return (manager, unlocks sheet back to draft with comment)
  - Audit log entry on every post-lock change
  ► COMMIT: "feat: goal sheet lifecycle with approval workflow"
  ✦ TEST: full happy path — employee creates sheet, adds 3 goals totalling 100%, submits; manager approves; confirm goals.is_locked=true in DB; employee tries to edit a locked goal → 403; manager returns sheet → goals.is_locked=false

PHASE 5 — Goals CRUD & shared goals
  - POST, PATCH, DELETE /goals with lock enforcement
  - POST /goals/shared — admin fans out a goal to a list of employee sheets; recipient rows get shared_from set; title and target read-only on those rows
  - Progress score computation utility (uom_type → score formula)
  ► COMMIT: "feat: goals CRUD, shared goals fanout, progress score utility"
  ✦ TEST: push a shared goal to 3 employees; verify each gets a goals row with shared_from set; attempt to edit title on a shared goal → 403; edit weightage → 200

PHASE 6 — Achievements & check-ins
  - POST /achievements (employee, within open cycle window only)
  - PATCH /achievements/{id}
  - Window guard middleware: reject writes outside cycle.window_open–window_close
  - POST /checkins (manager adds comment for a sheet + quarter)
  - GET /checkins/sheet/{sheet_id}
  ► COMMIT: "feat: quarterly achievement tracking and manager check-ins"
  ✦ TEST: log Q1 actual for an approved goal; verify computed score returned; try to log outside window → 422 with clear error; manager adds check-in comment; fetch check-ins for sheet → comment visible

PHASE 7 — Reports & audit
  - GET /reports/achievement → streaming CSV/Excel (use openpyxl)
  - GET /reports/completion → JSON summary per employee/manager (done vs pending check-ins)
  - GET /reports/audit/{goal_id} → full change log for that goal
  - POST /admin/unlock/{goal_id} → admin overrides lock, writes audit entry
  ► COMMIT: "feat: reports, audit trail, admin unlock"
  ✦ TEST: download achievement report — open in Excel, verify columns and data correct; check audit log after admin unlock → entry present; completion dashboard shows correct pending count

PHASE 8 — Frontend integration
  - Axios/fetch client with auth header injection
  - React Query (or SWR) for all API calls
  - Role-aware routing (React Router): employee layout, manager layout, admin layout
  - Pages: Login, My Goals, Goal Sheet form, Manager Dashboard, Admin Panel
  - Weightage validator live in the form (mirrors backend rules)
  ► COMMIT: "feat: frontend scaffolding with role-based routing and API client"
  ✦ TEST: log in as each of the 3 seeded roles; confirm each sees only their permitted nav items; employee creates and submits a goal sheet end-to-end in the UI

PHASE 9 — Deployment
  - railway.json: build command, start command, env var references
  - vercel.json: build output dir, rewrites for SPA routing
  - Set all env vars in Railway and Vercel dashboards
  - Push to main — confirm Railway builds backend, Vercel builds frontend
  - Update CORS origins in FastAPI to production frontend URL
  ► COMMIT: "chore: production deployment config for Railway and Vercel"
  ✦ TEST: hit production API /cycles/active from browser; log into production frontend as all 3 roles; run one full goal creation → submission → approval flow on production

PHASE 10 — Polish & demo prep
  - Error handling: global FastAPI exception handler → consistent JSON error shape
  - Loading states and toast notifications in frontend
  - Seed realistic demo data (3 employees, varied goal progress, 2 quarters of actuals)
  - Prepare role-switcher or shared login credentials doc for judges
  ► COMMIT: "chore: demo data, error handling polish, judge credentials"
  ✦ TEST: walk the full judge demo script — employee journey, manager journey, admin journey — without any console errors or broken states

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Do one phase at a time. Output all code for that phase before moving on.
- For each file, output the full file content (no truncation).
- When a phase is done, output the commit message and test checklist before asking to proceed.
- Use async SQLAlchemy throughout — no sync DB calls.
- Pydantic v2 for all request/response schemas.
- All endpoints return consistent JSON: { data: ..., error: null } or { data: null, error: { code, message } }
- Never store secrets in code — all config via environment variables loaded with python-dotenv.

Start with PHASE 0. Output all files for that phase, then the commit message, then the test checklist. Wait for me to confirm before proceeding to PHASE 1.