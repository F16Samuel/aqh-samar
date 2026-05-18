# AQH-SAMAR — Full-Stack Audit Report
## PART 3 of 4: Bonus Features + Frontend + Backend Architecture Audit

---

# 3. Bonus Features Evaluation (Additional /100)

---

## 3.1 Microsoft Entra ID Integration — **0 / 25**

**Status: Not Implemented.**

The system uses **Supabase Auth** exclusively. There is no Microsoft Entra ID / Azure AD OAuth flow, no MSAL integration, no tenant configuration, no group-to-role mapping from Entra ID, and no SSO redirect URI configuration.

The JWKS middleware supports both `HS256` (Supabase legacy) and `ES256` (Supabase modern) — this is sophisticated Supabase token handling, not Entra ID integration.

**No points awarded.**

---

## 3.2 Email & Teams Integration — **14 / 25**

### What Is Implemented

The system implements a **Mock Notification Hub** — a full in-app simulation of email and Microsoft Teams workflows:

- `MockNotification` DB model with fields: `type` (email/teams), `sender_id`, `recipient_id`, `subject`, `body`, `status`, `folder`, `interactive_payload`
- `POST /automation/notifications/compose` — compose and send mock emails/Teams messages
- `GET /automation/notifications?recipient_email=...` — scoped mailbox fetch
- `POST /automation/notifications/{id}/read` — mark read
- `PUT /automation/notifications/{id}/folder` — move to inbox/sent/junk/deleted
- `POST /automation/notifications/interactive-action` — Teams Adaptive Card callback that triggers real DB operations (approve sheet)
- The frontend Notification Hub (`app.notifications.tsx` — 38KB, largest file in the project) implements a full email client UI with folder navigation, compose window, message preview, read/unread status

### Positive Assessment

- The Adaptive Card JSON structure is correctly formatted (version 1.4, TextBlock with color/weight)
- The interactive callback actually modifies the database — sheet approval via Teams is real, not mocked
- `notify_manager` called in `submit_sheet` — escalation notifications are triggered by real events
- Folder system (inbox/sent/junk/deleted) is a significant UX investment

### Deductions

- **Not real Teams integration** — no MS Graph API, no webhook registration, no Bot Framework, no actual Teams tenant. The "Adaptive Card" is a JSON blob stored in the DB.
- **Not real email** — no SMTP, no SendGrid/SES/Mailgun, no actual email delivery.
- **Critical security bug** — the compose and interactive-action endpoints have no auth guards (see BUG-001, BUG-003). A real email system with this vulnerability would be a major breach.
- **Deep-link support** — not implemented. The BRD bonus mentions "deep-link support" which would allow Teams notifications to link directly to the relevant sheet.

### Score Justification

The mock hub is impressive in scope and the interactive callback is a clever design. Half-credit for the simulation quality, deducted for no real integration, no auth guards, no actual delivery.

**Score: 14/25**

---

## 3.3 Escalation Module — **18 / 25**

### What Is Implemented

- `AutomationRule` model — configurable trigger type, conditions (JSON), actions (JSON), is_active
- `EscalationTask` model — tracks running escalation timelines per employee with `current_step_index`, `next_run_at`, `sla_deadline`, `status`
- `EscalationHistory` model — audit trail of every executed action
- `automation_engine.py` — rule evaluation and task creation logic
- **APScheduler** with 30-second polling interval; fallback to asyncio background task if APScheduler unavailable
- **PostgreSQL advisory lock** (`pg_try_advisory_xact_lock`) for distributed safety
- `GET /automation/analytics` — SLA compliance index, manager responsiveness score (tiered: <24h=100, <72h=90, <168h=75), risk scoring matrix (composite 0-100), escalation heatmap per department
- `GET /automation/tasks` — active running tasks with next-run and deadline
- `GET /automation/history` — execution audit trail
- `POST /automation/simulate` — dry-run mode shows affected employees without DB mutation
- **Frontend** (`app.admin.automation.tsx` — 31KB) — full rule editor UI, SLA dashboard with heatmap, risk matrix table, responsiveness rankings, dry-run simulator

### Positive Assessment

- Rule engine is genuinely configurable (conditions as JSON dict, actions as JSON array)
- The advisory lock implementation for distributed scheduling is production-grade thinking
- Risk score formula is multi-factor (SLA breach + low completion + no checkin + manager responsiveness)
- Manager responsiveness scoring is data-driven from actual `submitted_at`/`approved_at` timestamps
- Dry-run simulation is a strong operational feature

### Deductions

- **Zero RBAC on all automation endpoints** — the entire escalation module is publicly accessible (BUG-001). This is the single biggest flaw.
- **30-second polling is too aggressive** for production — should be configurable; current setup hammers the DB every 30s regardless of load.
- **Escalation chain depth** — the system creates tasks but the step-by-step escalation chain (step 1: notify employee → step 2: notify manager → step 3: notify HR) isn't clearly differentiated in the rule structure. The `current_step_index` exists but the logic for advancing steps is unclear.
- **No rate limiting on rule execution** — a misconfigured rule could create thousands of EscalationTask rows.
- **`fetch_sla_analytics` hardcodes `"Q2"`** (line 209) for the checkin check — `CheckIn.quarter == "Q2"`. This is a hardcoded quarter value that will be wrong in any other quarter.

**Score: 18/25**

---

## 3.4 Analytics Module — **20 / 25**

### What Is Implemented

**Backend (`reports.py` — 828 lines):**
- `GET /reports/manager-analytics` — per-manager: mean, median, mode, std_dev, P25, P75, min, max, bias_index, bias_label, approval_rate, avg_goals_per_employee, thrust_area_distribution, quarterly_avg_scores, funnel, top_performers, at_risk, employee_scores
- `GET /reports/team-analytics` — per-employee: total_score, goal_details (per-goal score, weighted_score, variance, quarterly_breakdown), checkin frequency, thrust area aggregation
- `GET /reports/completion` — completion dashboard with per-employee and per-manager progress
- `GET /reports/department` — department-level average score
- `GET /reports/company` — company-wide average score
- Statistical helpers: `_mean`, `_median`, `_mode`, `_std_dev`, `_percentile` — all correctly implemented in pure Python

**Frontend (`app.admin.progress.tsx` — 448 lines):**
- Company KPI stat boxes (mean, median, std_dev, total_managers)
- Goal Sheet Funnel — donut PieChart
- Manager Score Distribution — grouped BarChart (mean vs median vs std_dev)
- Quarterly Score Trends — LineChart per manager
- Per-manager expandable cards with: employee score ranking bar chart, thrust area distribution bar chart, top performers / at-risk lists, P25/P75/mode/min/max/bias stat grid
- Cycle selector (historical analytics across cycles)
- `app.team.tsx` — team analytics for manager view with per-employee progress bars and quarterly scores

### Positive Assessment

- The statistical depth (P25, P75, mode, bias detection) is far beyond typical hackathon implementations
- Backend aggregation is server-side — no client-side computation of expensive stats
- Batched DB queries throughout — no N+1 in analytics paths
- Bias index formula (approval_rate - avg_score) is a credible proxy for grading bias
- The frontend visualization choices (donut for funnel, bar for distribution, line for trends) are appropriate

### Deductions

- **`_mode` implementation** rounds to 1 decimal place — for scores that are all unique (common in small datasets), mode returns an arbitrary value rather than "no mode / multimodal"
- **`any` typing throughout `app.admin.progress.tsx`** — `managers: any[]`, `m: any` — TypeScript safety completely abandoned in the analytics frontend
- **`GET /reports/department`** accessible by all roles including employees — an employee can see department aggregate scores; this may be intentional but is not gated
- **Quarterly trend line chart** uses manager first-name only as `dataKey` — if two managers share a first name, chart lines collide
- **No export of analytics data** — charts are view-only; no CSV/Excel export of analytics (achievement report export exists but analytics export doesn't)
- **`all_achs_by_goal` sorting** in `team-analytics` uses `updated_at or x.goal_id` — `goal_id` is a UUID, not a datetime; this sorting fallback is type-incorrect and produces unpredictable ordering

**Score: 20/25**

---

# 4. Frontend Architecture Audit

## Component Structure

```
src/
  routes/          — 20 file-based routes (TanStack Router)
  components/
    ui/            — shadcn/ui primitives
    goals/         — SheetStatusBadge
    feedback/      — EmptyState
  hooks/
    api.ts         — all React Query hooks (318 lines)
    queryKeys.ts   — centralised query key factory
  services/        — one file per domain (auth, users, cycles, goalSheets, goals, achievements, checkins, reports, admin)
  schemas/forms.ts — Zod schemas + validation helpers
  store/auth.store.ts — Zustand auth store
  types/api.ts     — TypeScript interfaces matching backend schemas
  constants/rbac.ts — QUARTERS, UOM_TYPES, GOAL_LIMITS, etc.
  utils/errors.ts  — errorMessage helper
  utils/math.ts    — frontend mean/median/stdDev (unused in analytics — backend computes)
```

### Strengths

- **Query key factory (`qk`)** — centralised, typed, hierarchical. Invalidation is precise.
- **Service layer** — clean separation of API call logic from React Query hooks.
- **Zod schemas** — form validation schemas with `GOAL_LIMITS` constants imported from shared constants file — single source of truth.
- **`errorMessage` utility** — extracts user-friendly messages from API error envelopes.
- **Auth store (Zustand)** — `bootstrapped` flag prevents flash of unauthenticated content during initial session check.

### Weaknesses

- **No optimistic updates** — goal creation, achievement logging, approval all wait for server round-trip before UI updates. For a performance management portal this is acceptable, but could improve perceived responsiveness.
- **No error boundaries** — if a React Query hook throws during render (e.g., malformed response), the entire route crashes with an unhandled error. Only the global error state in `app.tsx` catches auth failures.
- **`any` types in analytics pages** — `app.admin.progress.tsx` uses `any` extensively, undermining TypeScript's value.
- **`useMe` vs `useAuthStore`** — profile data exists in two places: the Zustand store (populated via `setProfile` in `app.tsx`) and React Query cache. If they desync, RBAC checks on the frontend can be stale.
- **No retry logic on mutations** — `onError: onErr` shows a toast but doesn't retry. For transient network failures, a single retry would improve resilience.
- **`app.achievements.tsx` state update during render** (BUG-005) — architectural issue in component lifecycle.
- **Route-level RBAC** — roles are checked via `navFor()` for sidebar visibility and `me?.role === "admin"` inline in components. No route-level `beforeLoad` guard — an employee who manually navigates to `/app/admin/progress` will hit the backend RBAC (returns 403) but sees a momentary render attempt.

## State Management

- **Zustand** — used only for auth state. Lightweight and appropriate.
- **React Query** — used for all server state. `staleTime` is consistently configured.
- **Local state** — `useState` for dialogs, form values, selected items. Appropriate granularity.
- **No global loading or error state** beyond the auth layer — each component manages its own.

## TypeScript Quality

- `types/api.ts` defines interfaces for all API response shapes. Generally accurate.
- `GoalOut`, `AchievementOut`, `UserOut`, `GoalSheetOut` etc. are well-typed.
- Analytics pages abandon TypeScript with `any` — this is the weakest area.
- Form schemas use Zod with `.infer<>` — excellent pattern.

---

# 5. Backend Architecture Audit

## API Design

- **Consistent envelope**: `{data: ..., error: null}` or `{data: null, error: {code, message}}` via `ok()` and `err()` helpers. Well-executed.
- **HTTP status codes**: 201 on create, 404 on not-found, 403 on forbidden, 422 on validation — correct throughout.
- **`APIRouter` per domain** — clean module separation.
- **Versioning** — `/api/v1/` prefix. Only one version, but the structure supports future versioning.

## Service Layer

The system lacks a formal service layer. Business logic lives directly in route handlers. For a hackathon this is acceptable, but in production the `goals.py` route handlers (280 lines) mix DB queries, business rules, and response formatting.

Exceptions:
- `core/validators.py` — validation logic extracted ✅
- `core/audit.py` — audit log writing extracted ✅
- `core/utils.py` — `compute_progress_score` and `is_window_open` extracted ✅
- `core/notifications.py` — `notify_manager` extracted ✅

## DB Modeling

| Aspect | Status |
|--------|--------|
| UUIDs as PKs | ✅ |
| FK relationships | ✅ Correctly declared |
| Cascade delete (goal_sheets → goals → achievements) | ✅ |
| `is_locked` Boolean with default=False | ✅ |
| `weightage` as Integer | ⚠️ Should be Float |
| `uom_type` as unvalidated String | ⚠️ No CheckConstraint or Enum |
| `status` as unvalidated String | ⚠️ No CheckConstraint |
| No unique constraint on `(employee_id, cycle_id)` for goal_sheets | ❌ |
| No unique constraint on `(goal_id, quarter)` for achievements | ❌ |
| No DB indexes on FK columns | ❌ |
| `updated_at` on achievements with `onupdate=datetime.utcnow` | ✅ |

## Validation

- Pydantic v2 schemas for all request bodies
- `goalFormSchema` + `validate_goal_limits` + `validate_sheet_submission` = three-layer validation
- Phase-string matching in `is_window_open` is fragile (see BUG-006)
- No input sanitisation for free-text fields (thrust_area, title, description, comment) — XSS risk in theory since the API serves JSON (not HTML rendered), but worth noting

## Middleware

- `AuthMiddleware` — correct dual-algo JWT handling (HS256 + ES256)
- `WindowGuardMiddleware` — only checks active cycle existence, not window dates — window date check is done per-handler. This is a reasonable design.
- **Middleware ordering issue** — `AuthMiddleware` is added AFTER `WindowGuardMiddleware` in `main.py`. Starlette applies middleware in reverse order, so `WindowGuardMiddleware` runs before `AuthMiddleware`. This means `WindowGuardMiddleware` runs on unauthenticated requests (it doesn't need auth, but the ordering is confusing and could cause issues if `WindowGuardMiddleware` ever tries to access `request.state.user`).
- `CORSMiddleware` added last (runs first due to reverse order) — correct.

## Transaction Safety

- `db.flush()` + validation + `db.commit()` pattern in `create_goal` and `update_goal` — correct optimistic validation.
- `db.rollback()` called on validation failure after flush — correct.
- `_auto_sync_shared_goals` runs within the same session/transaction as the primary achievement — correct.
- `write_audit_log` — needs verification whether it commits internally or relies on the caller to commit. If it auto-commits, the pattern in `update_goal` (calling write_audit_log after `db.commit()`) is correct.

## Scalability

- Async SQLAlchemy throughout — correct.
- No sync DB calls.
- Advisory lock for scheduler — production-ready for multi-instance.
- Unbounded queries on heavy endpoints remain the primary scalability concern.
