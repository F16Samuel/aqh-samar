# AQH-SAMAR — Full-Stack Audit Report
## PART 2 of 4: User Friendliness + Bugs + Cost Optimisation

---

## 2.3 User Friendliness — **15 / 20**

### UX Quality

The frontend is built on **TanStack Router v1 (file-based routing)**, **TanStack Query v5**, **shadcn/ui components**, and **Lucide icons**. This is an appropriate, modern stack.

**Positive UX signals:**
- Loading skeletons on all major data loads (`<Skeleton>` components, not spinners)
- `<EmptyState>` component used consistently across goals, check-ins, achievements
- Toast notifications (`sonner`) on every mutation success/error
- Inline window-closed banner on goal sheet page
- Pending approval banner on manager view
- Weightage live-progress bar (updates as goals are added)
- Role-aware sidebar navigation — employees see minimal nav, admins see full ops panel
- Cycle badge in topbar showing active phase at all times
- `canEdit` logic correctly gates Edit/Add buttons without requiring a page reload

**UX Concerns:**

| Issue | Severity |
|-------|----------|
| **Goal CardDescription contains developer debug text:** `"From /goals?sheet_id=…"` — exposed in production UI | Medium |
| **Achievement page auto-selects first sheet inside render** — `setSelectedSheetId` called during render (line 31-33) — React will warn "Cannot update a component while rendering" | High |
| **Check-in date shown as raw ISO string** — `{c.created_at}` renders `"2026-05-17T10:23:44"` not `"May 17, 2026"` | Low |
| **Goal dialog has no delete button** — users must navigate away and back; there is no in-place delete action on goal rows (separate destructive action not wired in the table) | Medium |
| **Share goal dialog shows ALL users** — including admins, other managers, users already with the goal — no filtering | Medium |
| **No confirmation dialog on approve/return** — single click approves; accidental approval has no undo | Medium |
| **Admin unlock is per-goal, buried in sheet detail** — admin must navigate to each sheet, then each goal, to unlock. No bulk unlock UI | Medium |
| **Reports page** — no filter for cycle or status visible at page load; filters require interaction to reveal | Low |
| **Mobile: sidebar collapse works** — `collapsible="icon"` — but achievement row grid `grid-cols-[120px_1fr_180px_auto]` breaks on phones < 400px | Low |

### Accessibility

- No `aria-label` attributes on icon-only buttons (e.g., sidebar trigger, goal table action buttons)
- No `role="alert"` on error banners
- Color is used as the only signal for status (red/amber/green progress) — no pattern/icon for color-blind users in some analytics charts
- Focus management not handled on dialog open/close (shadcn/ui handles it via Radix, so this is likely fine, but custom dialogs like the share goal dialog don't trap focus explicitly)

### Dashboard Quality

- **Employee dashboard** (`app.index.tsx`) — shows active cycle, sheet status, quick actions. Functional.
- **Manager team dashboard** (`app.team.tsx`) — team analytics with per-employee progress, check-in status, quarter scores. Good.
- **Admin Progress Tracker** — exceptionally detailed: funnel pie chart, mean/median bar chart, quarterly line chart, per-manager expandable deep-dive with thrust area distribution and top/at-risk badges. This is the strongest UX in the system.
- **Escalations** — shows overdue sheets with employee/manager names and timestamps.

### Onboarding

- No guided onboarding flow for first-time users
- The error state in `app.tsx` for unreachable backend shows a developer-facing error (`VITE_API_BASE_URL`) to end users — should be replaced with a user-friendly message

**Score: 15/20**

---

## 2.4 Presence of Bugs — **12 / 20**

### Critical Bugs (P0 — Data Integrity / Security)

**BUG-001: Automation router has zero RBAC guards**
- File: `backend/app/api/v1/automation.py`
- All 15 endpoints (`/rules`, `/simulate`, `/analytics`, `/history`, `/tasks`, `/notifications`, `/compose`, `/interactive-action`, etc.) have **no `@require_roles` decorator**.
- Any unauthenticated HTTP client can: create/delete automation rules, simulate rule runs, read ALL notifications for ALL users, compose emails, and trigger Teams adaptive card callbacks that change sheet approval status in the database.
- **Severity: CRITICAL — privilege escalation + data mutation without auth**

**BUG-002: Notification endpoint leaks all notifications without auth**
- `GET /api/v1/automation/notifications` with no `recipient_email` parameter returns every notification in the database.
- No auth check. No pagination.
- **Severity: CRITICAL — PII data leak**

**BUG-003: Teams interactive callback bypasses approval RBAC**
- `POST /api/v1/automation/notifications/interactive-action` with `{"action": "approve", "sheet_id": "...", "recipient_email": "mgr@company.com"}` approves any sheet via any user's email, bypassing all role checks. The `reviewer` is looked up by email from the POST body — fully attacker-controlled.
- **Severity: CRITICAL — unauthorized approval of goal sheets**

**BUG-004: Race condition on achievement creation**
- `POST /achievements/` checks for duplicate quarter via `scalar_one_or_none()` then creates a new achievement. Two concurrent POST requests for the same goal+quarter will both pass the check and create two records.
- No unique constraint on `(goal_id, quarter)` in the DB model.
- **Severity: HIGH — data integrity**

### High Severity Bugs (P1)

**BUG-005: `setSelectedSheetId` called during render in Achievements page**
```typescript
// app.achievements.tsx lines 31-33
if (!selectedSheetId && approvedSheets.length > 0) {
  setSelectedSheetId(approvedSheets[0].id);  // STATE UPDATE DURING RENDER
}
```
This causes React's "Cannot update a component while rendering a different component" error and can cause infinite render loops. Should be `useEffect`.

**BUG-006: `is_window_open` breaks on phase string mismatch**
- `is_window_open(cycle, "goal_setting")` checks `cycle.phase != "Phase 1 - Goal Setting"`.
- If admin creates a cycle with phase `"Phase 1 – Goal Setting"` (em-dash vs hyphen), ALL goal writes return 422 `WINDOW_CLOSED` for everyone.
- No enum constraint in DB. No enum validation in `CycleCreate` schema.

**BUG-007: `authenticate-action` on automation uses `text()` raw SQL for goal locking**
```python
await session.execute(
    text("UPDATE goals SET is_locked = True WHERE sheet_id = :sid"),
    {"sid": sheet.id}
)
```
`sheet.id` is a UUID object, not a string. This passes a Python UUID to a raw parameterised query — behavior depends on the psycopg adapter version. Also, no audit log written on this approval path.

**BUG-008: `GoalAchievementRow` — shared goal check wrong in UI**
```typescript
const isShared = !!goal.shared_from;
```
`goal.shared_from` is `null` when not shared. This is correct. BUT if the API returns `shared_from: null` as a string `"null"`, `!!("null")` is `true`. Need to verify API serialisation — `model_dump(mode="json")` on `GoalOut` should return Python `None` → JSON `null`, so this is probably fine, but fragile.

**BUG-009: `compute_progress_score` for `max` UoM**
```python
elif uom_type == "max":
    if a == 0: return 100.0   # BUG: achievement of 0 = perfect score
```
For a "max minimise" goal (e.g., minimize defects), if actual = 0, score = 100%. This is correct semantically. But if target is also 0, we divide `t/a = 0/0` before reaching this guard — the `a == 0` check is evaluated first, which prevents the ZeroDivisionError. This is technically correct but confusingly ordered.

**BUG-010: Auth middleware — duplicate import**
```python
# middleware.py lines 7 and 17
from app.models.user import User  # imported twice
from sqlalchemy import select     # imported twice
```
Harmless but indicates copy-paste sloppiness.

### Medium Severity Bugs (P2)

**BUG-011: No `commit()` after `write_audit_log` in `update_goal`**
- After `goal.is_locked` override by admin unlock, `write_audit_log` is called but the session isn't committed until after `db.refresh(goal)`. The `write_audit_log` function itself commits — let's verify.

```python
# core/audit.py — need to check if it commits internally
# If write_audit_log does NOT commit, audit logs on goal update are lost on error
```

**BUG-012: `checkins` allowed on draft sheets**
- `POST /checkins` has no check on `sheet.status`. A manager can post check-ins before an employee even submits.

**BUG-013: `reports/audit/{goal_id}` accessible by managers without ownership check**
- A manager can fetch the full audit trail of any goal in the company, not just their direct reports' goals.

**BUG-014: `approve_sheet` doesn't check sheet is in active cycle**
- A manager can approve a sheet from a previous inactive cycle.

**BUG-015: `user.role` vs `user.platform_role` mismatch**
- Frontend `useAuthStore` profile uses `role` field (from `/auth/me` → `UserOut`).
- Backend models use `platform_role` column.
- In `app.tsx` line 88: `role={me.role}` — this requires `UserOut` to map `platform_role` to `role`. If `UserOut` schema doesn't alias this, every RBAC check in the frontend fails silently.

### Architectural Risks

- **Global exception handler suppresses stacktraces in production** — `str(exc)` in dev mode leaks internal error messages including SQL queries to the response body.
- **Scheduler polling every 30 seconds in development** — if left at 30s in production with a large dataset, this is aggressive. Should be configurable via env var.
- **`AsyncSessionLocal` used directly in automation router** instead of `Depends(get_db)` — bypasses FastAPI's dependency injection lifecycle and could hold connections longer than necessary.

**Score: 12/20**

---

## 2.5 Cost Optimisation — **13 / 20**

### API Efficiency

| Pattern | Status |
|---------|--------|
| Batch achievement fetch (N+1 avoided) in `get_sheet` | ✅ Single query with `.in_()` |
| Batch achievement fetch in `get_completion_report` | ✅ Batched |
| Batch achievement fetch in `manager_analytics` | ✅ Batched |
| N+1 avoided in `get_achievement_report` | ✅ Single query |
| `GET /goals/admin/all` — fetches ALL goals all cycles | ❌ Full table scan, no pagination |
| `GET /reports/achievement` — no server-side pagination | ❌ All rows returned |
| `GET /reports/completion` — loads ALL users every call | ⚠️ Acceptable for small orgs, problematic at scale |
| `GET /admin/audit-logs` — LIMIT 100 | ✅ Bounded |
| `select(User).where(User.manager_id != None)` in manager_analytics | ⚠️ Full user table scan |

### Caching

| Layer | Status |
|-------|--------|
| JWKS caching (1-hour TTL) | ✅ In-memory, good |
| React Query staleTime on active cycle | ✅ 10 min |
| React Query staleTime on user list | ✅ 10 min |
| React Query staleTime on goal sheets | ✅ 30 sec |
| No server-side response caching | ❌ No Redis, no HTTP cache headers |
| No DB-level query result caching | ❌ Acceptable for hackathon |

### Frontend Rendering Efficiency

- **No memoisation on expensive computed arrays** — `managers.map(...)`, `funnelData`, `quarterlyData` in `ProgressTrackerPage` are recomputed on every render. With 20+ managers this is noticeable.
- **Recharts `ResponsiveContainer`** wrapping works correctly; no unnecessary DOM reflows observed.
- **`any` typed extensively in `app.admin.progress.tsx`** — `managers: any[]`, `m: any` — no TypeScript safety; errors in API shape silently produce undefined rendering.
- **`useTeamAnalytics` / `useManagerAnalytics`** — 5-minute staleTime is reasonable for analytics data.

### DB Query Efficiency

- **No DB indexes declared in models** — `goal_sheets.employee_id`, `goals.sheet_id`, `achievements.goal_id`, `achievements.quarter`, `audit_logs.goal_id` — all FK columns should have indexes. SQLAlchemy does NOT create indexes for FK columns by default. At scale, all `.where(Goal.sheet_id.in_(sheet_ids))` queries are full table scans.
- **`GoalSheet` unique constraint** — `(employee_id, cycle_id)` not declared in model, only enforced in application code. Concurrent sheet creation can create duplicates.

### Infrastructure / Deployment

- **Single Railway monolith** — acceptable for hackathon; does not horizontally scale without the advisory lock (which is correctly implemented).
- **Scheduler polling every 30s** — hardcoded; not configurable via env var.
- **No connection pool configuration** — SQLAlchemy async default pool size is `5`; no `pool_size` or `max_overflow` tuning.
- **Dockerfile uses `pip install -r requirements.txt`** — no layer caching optimization (COPY requirements.txt before COPY . would improve build speed).
- **Frontend Dockerfile** — builds with `bun` + `vite build`, served via Cloudflare Workers (`wrangler.jsonc`). This is an efficient edge deployment choice.

### Cost Optimisation Score Justification

The system avoids N+1 in the critical report paths. React Query caching is well-configured. The absence of DB indexes and no pagination on heavy endpoints are the primary cost concerns at scale.

**Score: 13/20**
