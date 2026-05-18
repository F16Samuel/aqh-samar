# AQH-SAMAR — Full-Stack Audit Report
## PART 4 of 4: Security Review + Production Readiness + Final Scores

---

# 6. Security Review

## JWT Handling — ⚠️ Partially Sound

| Check | Status | Notes |
|-------|--------|-------|
| JWT decoded server-side | ✅ | `python-jose` with correct algorithms |
| HS256 + ES256 both supported | ✅ | Dual-algo routing based on `alg` header |
| JWKS fetched from Supabase with 1-hour cache | ✅ | Avoids per-request JWKS calls |
| Audience verification disabled | ⚠️ | `"verify_aud": False` — acceptable for Supabase |
| Expired token handling | ✅ | `JWTError` caught, `request.state.user = None` |
| **Silent failure on bad token** | ❌ | Invalid token → `state.user = None`, no 401 returned by middleware. Relies entirely on `require_roles` to catch. Routes without `require_roles` process unauthenticated requests. |
| Token not blacklisted on logout | ✅ | Acceptable — Supabase client handles session invalidation |

## RBAC Enforcement — ❌ BROKEN for Automation Router

| Endpoint Group | Guard |
|----------------|-------|
| `/api/v1/auth/*` | ✅ `@require_roles` |
| `/api/v1/users/*` | ✅ `@require_roles` |
| `/api/v1/cycles/*` | ✅ `@require_roles` |
| `/api/v1/goal-sheets/*` | ✅ `@require_roles` |
| `/api/v1/goals/*` | ✅ `@require_roles` |
| `/api/v1/achievements/*` | ✅ `@require_roles` |
| `/api/v1/checkins/*` | ✅ `@require_roles` |
| `/api/v1/reports/*` | ✅ `@require_roles` |
| `/api/v1/admin/*` | ✅ `@require_roles("admin")` |
| **`/api/v1/automation/*`** | ❌ **ZERO guards on all 15 endpoints** |

The automation router (`automation.py`, 524 lines) is entirely unprotected. This is the most critical security vulnerability in the system.

## Injection Risks

- **`POST /automation/notifications/interactive-action`** — `sheet_id` from request body is passed to `UUID(sheet_id)` which will raise a `ValueError` on invalid UUIDs (caught by FastAPI's 500 handler). No SQL injection since parameterised queries are used throughout.
- **Raw SQL in interactive-action** — `text("UPDATE goals SET is_locked = True WHERE sheet_id = :sid")` with `:sid` parameter — safe from SQL injection via parameterisation, but the `sid` is a Python UUID object passed to a `:sid` named parameter — this depends on the psycopg/asyncpg driver correctly serialising UUID objects. **Functionally risky**, not a SQL injection risk.
- **Freeform text fields** — `title`, `description`, `comment`, `thrust_area` stored as-is. No XSS risk since API returns JSON (not rendered HTML). Safe.
- **`data: dict` as Pydantic model** in automation endpoints — `create_rule(data: dict)` accepts arbitrary JSON with no schema validation. An attacker could send `{"name": null, "trigger_type": null}` which would cause a Python `TypeError` when accessing `data["name"]`. FastAPI's global exception handler catches this and returns 500, leaking internal details in dev mode.

## Privilege Escalation Risks

1. **BUG-003** — Anonymous HTTP client can approve any goal sheet via `POST /automation/notifications/interactive-action`.
2. **Manager approval without cross-cycle check** — a manager can approve sheets from inactive cycles.
3. **`GET /reports/audit/{goal_id}` accessible by managers** — managers can view audit logs for employees they don't manage.
4. **`POST /goals/shared`** — allows managers to push shared goals, not just admins. BRD says "admin pushes a KPI." Manager-level sharing is an undocumented privilege escalation.

## Sensitive Data Exposure

- **Dev-mode error messages** — `str(exc)` returned in 500 responses when `APP_ENV == "development"`. If dev mode is accidentally active in production, full Python exceptions (including SQL queries) are exposed.
- **`/automation/notifications`** without `recipient_email` filter — returns ALL notifications for ALL users. Full PII exposure to unauthenticated callers.
- **`/auth/me` returns full `UserOut`** including `department_id`, `manager_id`, `job_title` — this is appropriate for authenticated users.

## Auth Bypass Possibilities

1. **Automation router** — no auth required. Complete bypass.
2. **`/health` endpoint** — intentionally public. Appropriate.
3. **`/docs` and `/redoc`** — FastAPI auto-docs publicly accessible. In production, these should be disabled (`docs_url=None, redoc_url=None`) or IP-restricted.
4. **CORS** — `allow_origins=settings.cors_origins_list` — if `CORS_ORIGINS` env var is set to `"*"`, all CORS restrictions are bypassed. Need to verify env configuration.

---

# 7. Production Readiness Verdict

## Category: **Hackathon Prototype (leaning Beta Quality)**

### Why Not Production Ready

1. **CRITICAL security vulnerability** — the entire `/api/v1/automation/*` router (15 endpoints) has no authentication or authorisation. Any unauthenticated internet user can approve goal sheets, compose notifications, modify automation rules, and read all users' notifications.

2. **No database indexes** — at production scale (1000+ employees), queries on `goal_id`, `sheet_id`, `employee_id`, `quarter` without indexes will cause full table scans. Performance degrades O(n) with data volume.

3. **No unique DB constraints** on `(employee_id, cycle_id)` and `(goal_id, quarter)` — race conditions can corrupt data.

4. **Unbounded API responses** — no pagination on `GET /reports/achievement`, `GET /goals/admin/all`, `GET /reports/completion` (for admins). At 1000 employees × 8 goals = 8000 rows per API call.

5. **`/docs` publicly accessible in production** — the live AWS deployment has Swagger UI accessible without authentication.

### Why It's Impressive for a Hackathon

1. All core BRD workflows implemented and functional end-to-end
2. Correct progress-score formulas with proper edge cases
3. Real async PostgreSQL with SQLAlchemy, not SQLite
4. Proper JWT validation with dual-algorithm support and JWKS caching
5. PostgreSQL advisory lock for distributed scheduler safety
6. Server-side statistical analytics (mean/median/mode/std-dev/bias)
7. Interactive Teams Adaptive Card simulation with real DB callbacks
8. 828-line reports module with 6 distinct report types
9. Full frontend with proper loading states, empty states, toasts, role-aware navigation
10. Deployed on AWS ECS + Cloudflare Workers — real cloud infrastructure

### Fix Priority for Production

| Fix | Effort | Impact |
|-----|--------|--------|
| Add `@require_roles` to all automation endpoints | 1 hour | CRITICAL |
| Add `recipient_email` auth guard to notifications | 30 min | CRITICAL |
| Add DB unique constraint `(goal_id, quarter)` | 30 min | HIGH |
| Add DB unique constraint `(employee_id, cycle_id)` | 30 min | HIGH |
| Add DB indexes on FK columns | 1 hour | HIGH |
| Add pagination to `/reports/achievement` and `/goals/admin/all` | 2 hours | HIGH |
| Fix `setSelectedSheetId` during render (BUG-005) | 15 min | MEDIUM |
| Hardcode fix for `Q2` in SLA analytics | 15 min | MEDIUM |
| Disable `/docs` in production | 5 min | MEDIUM |
| Fix `checkins` on draft sheets | 30 min | LOW |

---

# 8. Final Scores

## BASE SCORE

| Category | Score | Max |
|----------|-------|-----|
| **Functionality of the Portal** | 16 | 20 |
| **Adherence to BRD** | 15 | 20 |
| **User Friendliness** | 15 | 20 |
| **Presence of Bugs** | 12 | 20 |
| **Cost Optimisation** | 13 | 20 |
| **TOTAL BASE SCORE** | **71** | **100** |

---

## BONUS SCORE

| Category | Score | Max |
|----------|-------|-----|
| **Microsoft Entra ID Integration** | 0 | 25 |
| **Email & Teams Integration** | 14 | 25 |
| **Escalation Module** | 18 | 25 |
| **Analytics Module** | 20 | 25 |
| **TOTAL BONUS SCORE** | **52** | **100** |

---

## COMBINED INFORMATIONAL TOTAL

| | Score |
|-|-------|
| Base Score | 71 / 100 |
| Bonus Score | 52 / 100 |
| **Combined Total** | **123 / 200** |

---

## Score Rationale Summary

**Functionality (16/20):** Core happy-path is solid. Deducted for: no sheet deletion, checkins on draft sheets allowed, manager inline-edit audit gap, no pagination on reports, audit log inconsistency between endpoints.

**BRD Adherence (15/20):** All Phase 1 requirements implemented. Phase 2 quarterly window model has a structural mismatch (single-phase cycle vs multi-quarter model), `checkins_pending` formula is naive, weightage stored as integer.

**User Friendliness (15/20):** Frontend is genuinely polished — loading skeletons, empty states, toasts, role-aware nav, excellent analytics dashboards. Deducted for: debug text in production UI, state-during-render bug, no confirmation on approval, raw ISO dates displayed, share goal dialog shows all users unfiltered.

**Bugs (12/20):** Three CRITICAL security bugs (unguarded automation router, notification PII leak, unauthenticated sheet approval via interactive callback), one HIGH race condition, multiple medium severity logic and UX bugs. The CRITICAL bugs alone justify this score — a production judge would reject the submission.

**Cost Optimisation (13/20):** Good batching in report queries, React Query staleTime well-configured, JWKS caching present. Major deductions for: no DB indexes, no pagination, 30s scheduler hardcoded, `any` typing preventing compile-time optimisation.

**Entra ID (0/25):** Not implemented.

**Teams/Email (14/25):** Mock hub is architecturally interesting and the interactive callback is genuinely clever. Half credit for the simulation depth. No real integration, no auth guards.

**Escalation (18/25):** Rule engine is real, scheduler with advisory lock is impressive, SLA analytics are data-driven. Deductions for: no RBAC, hardcoded Q2, aggressive 30s polling.

**Analytics (20/25):** Best module in the system. Full statistical suite, multi-layer visualizations, server-computed aggregations, per-manager deep-dive. Deductions for: `any` typing, no export, mode edge case, name collision in quarterly chart.

---

## What Would Push This to 85+/100

1. Fix the three CRITICAL security vulnerabilities (15-20 min of code)
2. Add DB indexes and unique constraints (1 hour)
3. Add pagination to heavy endpoints (2 hours)
4. Fix the `setSelectedSheetId` render bug (15 min)
5. Fix `checkins_pending` formula to be quarter-aware
6. Add `changed_by_name` to `GET /reports/audit/{goal_id}` response
7. Enforce `uom_type` and `status` as DB-level enums/check constraints
8. Fix weightage to `Float` in the DB model

The engineering foundation is strong. The gaps are fixable. This is a credit to the development team.
