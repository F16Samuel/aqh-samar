# AQH-SAMAR — Full-Stack Audit Report
## PART 1 of 4: Executive Summary + Functionality + BRD Adherence

**Audit Date:** 2026-05-19  
**Auditor:** Enterprise Evaluation Panel (Staff Engineering, QA, Security, DevOps, Product)  
**Codebase:** s:/aqh-samar (monorepo — FastAPI backend + Vite/React/TypeScript frontend)

---

# 1. Executive Summary

## Brutally Honest Overview

The AQH-SAMAR Goal Setting & Tracking Portal is a **substantially complete, technically credible hackathon entry** that demonstrates genuine engineering depth in several areas. The backend is cleanly structured, the core BRD workflows are implemented end-to-end, the progress-score formulas are correct, and the bonus analytics module is impressive in scope.

However, the project is held back from "production-ready" status by a cluster of architectural gaps that would cause real operational failures under enterprise conditions: the auth middleware silently ignores invalid tokens (no 401 on bad JWT), the `is_window_open` check is **phase-name string-matched** meaning any typo in seed data breaks all writes, the automation router has **zero RBAC guards** on every single endpoint, shared-goal achievement sync only flows on write and breaks if both parties edit concurrently, and the completionReport's `checkins_pending` formula is naive (`4 - count`) rather than tracking which quarters are truly open.

The frontend is polished, uses TanStack Router + React Query correctly, has proper loading skeletons, empty states, toast notifications, and inline validation. The UX is materially better than most hackathon portals. The analytics dashboards (Recharts, stat boxes, per-manager deep-dive) are genuinely impressive.

## Main Strengths

1. **Correct progress-score formulas** — `min`, `max`, `timeline`, `zero` all implemented correctly with edge-case guards.
2. **Dual-layer validation** — Zod on the frontend + `validate_goal_limits` / `validate_sheet_submission` on the backend, logically consistent.
3. **Shared-goal fan-out with achievement auto-sync** — structurally correct; `_auto_sync_shared_goals` covers both create and update paths.
4. **Hierarchical analytics** — mean/median/mode/std-dev/P25/P75/bias-index/funnel, all server-computed; no fake client-side math.
5. **PostgreSQL advisory lock on scheduler** — `pg_try_advisory_xact_lock` for distributed safety is a senior-level design choice.
6. **Consistent API contract** — `{data, error}` envelope on every response; global exception handler catches unhandled exceptions.
7. **JWKS caching** — 1-hour TTL in-memory cache for Supabase public keys, preventing per-request JWKS fetches.
8. **Role-aware navigation** — clean `navFor(role)` function; routes correctly gated on the frontend.
9. **Audit trail** — `write_audit_log` called on every post-lock change and status transition.
10. **Production deployment config** — Dockerfile + railway.json + wrangler.jsonc all present and structurally correct.

## Main Weaknesses

1. **Automation router has no `@require_roles` guards** — any unauthenticated user can call `POST /api/v1/automation/simulate`, `PUT /api/v1/automation/rules/{id}`, `DELETE /api/v1/automation/rules/{id}`, `POST /api/v1/automation/notifications/compose`, etc.
2. **Auth middleware swallows all JWT errors silently** — malformed/expired tokens leave `request.state.user = None`; endpoints rely on `require_roles` to catch it, but unauthenticated requests to undecorated routes go through.
3. **`is_window_open` uses exact string match on `cycle.phase`** — breaks if seed data or admin creates a cycle with a slightly different phase label. No enum constraint in the DB model.
4. **`/api/v1/automation/notifications` endpoint leaks all notifications to unauthenticated callers** if no `recipient_email` filter is provided — no auth guard, returns full mailbox to anyone.
5. **Manager can approve their own sheet** — `POST /goal-sheets/{id}/approve` checks `emp.manager_id == user.id` but a manager who is also the employee's `approved_by` could trigger circular approval if the DB allows it.
6. **No DB-level unique constraint on `(goal_id, quarter)` in achievements** — the application-level check uses `scalar_one_or_none()` but concurrent POST requests can race past it.
7. **`checkins_pending` formula** — `(1 - count)` or `(4 - count)` is naive; doesn't account for which quarters are actually open or completed.
8. **Weightage stored as `Integer`** — `Float` weightage (e.g., 33.33%) is truncated at the DB layer; BRD doesn't prohibit non-integer weightages and the frontend allows `step="any"`.
9. **`validate_goal_limits` double-counts on update** — the flushed goal is in the session, so the re-fetched list includes it; this works correctly but only by coincidence of SQLAlchemy flush semantics.
10. **`/reports/audit/{goal_id}` allows `manager` role** — but doesn't check that the manager owns the goal's employee. A manager can fetch audit logs for any goal in the system.

## Production Readiness Verdict

**Beta Quality / Hackathon Prototype boundary.**  
Core workflows are real and functional. Security gaps (unguarded automation router, notification leak) would require fixes before any real-user deployment.

---

# 2. Core Evaluation (Out of 100)

---

## 2.1 Functionality of the Portal — **16 / 20**

### What Works End-to-End

| Flow | Status |
|------|--------|
| Employee creates draft sheet | ✅ Implemented + window guard |
| Employee adds goals (1–8) | ✅ With count + weightage validation |
| Employee submits sheet | ✅ With `validate_sheet_submission` (exact 100%) |
| Manager reviews + approves | ✅ Locks goals via bulk `UPDATE` |
| Manager returns for rework | ✅ Unlocks goals, creates check-in entry |
| Manager inline edit before approve | ✅ Allowed via `is_manager` flag in `PATCH /goals/{id}` |
| Employee logs Q1–Q4 achievements | ✅ Quarter-keyed, window-validated |
| Progress score computation | ✅ All 4 UoM types correct |
| Shared goal fan-out | ✅ `shared_from` FK, read-only on title/target/thrust |
| Achievement auto-sync to shared goals | ✅ `_auto_sync_shared_goals` on create and update |
| Admin unlock | ✅ Single goal, audit log written |
| Achievement CSV/XLSX export | ✅ openpyxl, streaming response |
| Completion dashboard (JSON) | ✅ Per-employee, per-manager aggregation |
| Audit trail per goal | ✅ `GET /reports/audit/{goal_id}` |
| Check-in module | ✅ Manager posts per quarter, fetched per sheet |
| Admin cycle management | ✅ CRUD with `is_active` flag |

### Critical Failures / Missing Flows

1. **No `DELETE /goal-sheets/{id}`** — employees cannot delete an incorrectly created draft sheet. If window closes before they notice, they are stuck with a draft they cannot remove.
2. **No inline edit tracking** — when a manager edits goals before approval, no audit log is written (audit log only writes post-`approved`/`locked` status; the sheet is `submitted` when manager edits, so audit log is skipped).
3. **`GET /reports/audit/{goal_id}` — no `changed_by_name`** — the response returns `changed_by` UUID only; the frontend cannot display who made the change without a second lookup (the admin audit-logs endpoint does include `changed_by_name`, so there's an inconsistency).
4. **Achievement page does not show progress score trend** — only shows latest badge with score. No sparkline or quarterly breakdown in the employee view.
5. **No pagination on any list endpoint** — `GET /reports/achievement` fetches all goals in the cycle unbounded; at 1000 employees × 8 goals = 8,000 rows in one query with N achievments joined.
6. **`/goals/admin/all` fetches ALL goals across ALL cycles** — no pagination, no cycle filter; with large data this is a full table scan.
7. **Checkins allowed on un-submitted sheets** — `POST /checkins` does not validate that the sheet is in `submitted` or `approved` state; a manager can post check-ins on a `draft` sheet.

### Score Justification

Strong happy-path coverage but missing sheet deletion, no pagination on reports, and minor workflow gaps (checkins on drafts, audit log on manager inline edits) prevent a higher score.

**Score: 16/20**

---

## 2.2 Adherence to BRD — **15 / 20**

### BRD Requirements Implemented

| Requirement | Status | Notes |
|-------------|--------|-------|
| Goal thrust area, UoM, target, weightage | ✅ | All fields present in model |
| Weightage total = 100%, min 10% per goal | ✅ | Two-phase validation (incremental + submission) |
| Max 8 goals per employee | ✅ | Enforced on create + validate |
| Manager approval → locks goals | ✅ | Bulk UPDATE, `is_locked=True` |
| Manager return → unlocks, rework status | ✅ | Implemented correctly |
| Shared goals — admin pushes KPI | ✅ | `POST /goals/shared`, `shared_from` FK |
| Shared goals — recipients adjust weightage only | ✅ | Title/target/thrust_area blocked on PATCH |
| Shared goal achievement sync from primary | ✅ | `_auto_sync_shared_goals` |
| Q1/Q2/Q3/Q4 achievement logging | ✅ | Quarter key, window-validated |
| Achievement status: Not Started/On Track/Completed | ✅ | Enum enforced in schema |
| System-computed progress scores (min/max/timeline/zero) | ✅ | Formulas correct |
| Manager check-in per quarter | ✅ | `POST /checkins` |
| Audit trail post-lock | ✅ | `write_audit_log` called |
| Admin unlock with audit entry | ✅ | `POST /admin/unlock/{goal_id}` |
| Achievement report (CSV/Excel) | ✅ | Both formats, streaming |
| Completion dashboard | ✅ | JSON, per-employee, per-manager |
| Cycle window enforcement | ✅ | `is_window_open` guard |

### Partially Implemented Requirements

| Requirement | Gap |
|-------------|-----|
| **Cycle-enforced check-in windows (Q1=July; Q2=Oct; Q3=Jan; Q4=Mar/Apr)** | `is_window_open` checks `cycle.phase` string equality. A single active cycle can only be in ONE phase at a time. BRD implies quarterly windows within a single annual cycle. The model doesn't support a cycle having multiple simultaneous open windows. |
| **Min UoM: Achievement ÷ Target** | ✅ Correct. Capped at 100 via `min((a/t)*100, 100.0)`. |
| **Max UoM: Target ÷ Achievement** | ⚠️ Formula is `(t/a)*100` — returns 100 if `t >= a`. This means if achievement equals target, score is 100%; if achievement exceeds target, score is < 100%. This is **inverted from typical Max UoM** where more is worse. The BRD says "Max" means minimise, so this is actually correct but non-obvious. |
| **Timeline UoM: binary 100/0** | ✅ Implemented but only binary. No partial credit for "close to deadline." BRD says "completion date vs deadline" — binary interpretation is the simplest reading. |
| **Check-in windows per quarter** | Only checked against current active cycle's single window. If a Q2 check-in window is active but `cycle.phase == "Q1 Check-in"`, Q2 writes are rejected. |

### Missing Requirements

| Requirement | Status |
|-------------|--------|
| **Employee cannot create >1 sheet per cycle** | ✅ Checked via `ALREADY_EXISTS` guard |
| **Manager cannot create a personal sheet** | ✅ Explicitly blocked with 403 |
| **Escalation report** — `GET /admin/escalations` returns sheets stuck >7 days submitted | ✅ Implemented |
| **`GET /reports/completion` — done vs pending check-ins per employee** | ⚠️ `checkins_pending = (4 - checkins_completed)` is naive; doesn't correlate to open quarters |
| **Audit log on every post-lock change** | ⚠️ Audit log is only written when `sheet.status in ("approved", "locked")`; when a manager edits a goal of a submitted sheet (allowed in PATCH), no audit log is written |
| **No `/auth/refresh` or `/auth/logout` server-side implementation** | Returns stub message — acceptable since Supabase client handles it natively |

### BRD Violations

1. **Weightage stored as `Integer`** — BRD doesn't restrict to integers. Frontend sends integer steps but the schema allows float; DB truncates. A weightage of 33.33% would fail to sum to 100.
2. **No enforcement that a goal's `thrust_area` matches any predefined set** — freeform string; BRD implies standard thrust areas.
3. **`checkins_pending` formula** — structurally incorrect; a sheet with 5 check-ins returns `checkins_pending = -1` (clamped to 0) rather than accurately reflecting open quarters.

**Score: 15/20**
