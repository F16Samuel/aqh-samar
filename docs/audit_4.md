# Goal Setting & Tracking Portal - Engineering Audit Report

## 1. Executive Summary
The AQH-SAMAR Goal Setting & Tracking Portal presents a polished exterior with a modern frontend stack and comprehensive feature coverage. However, the engineering audit reveals **critical security vulnerabilities** and **fragile architectural patterns** that make it unsuitable for production in its current state.

- **Main Strengths:** High-quality UI/UX using modern design tokens (`oklch`), thorough reporting module with Excel/CSV export, and comprehensive route coverage for all three user roles.
- **Main Weaknesses:** **Critical security bypass** in JWT middleware (signature verification disabled), logical deadlocks in goal creation due to premature weightage validation, and significant performance bottlenecks (N+1 queries) in the reporting layer.
- **Production Readiness Verdict:** **Fragile Demo / Non-Functional (Production Security Risk).** The system allows trivial impersonation of any user, including administrators.

---

## 2. Core Evaluation (Out of 100)

### 2.1 Functionality of the Portal ( 12 / 20 )
**Justification:** While the end-to-end workflow (Draft → Submit → Approve) is implemented, it suffers from a logical "deadlock." The backend enforces 100% weightage on *every* goal write, making it impossible to add goals one by one unless the first goal is 100% and then adjusted.
- **Critical Failures:**
    - **Weightage Deadlock:** Employees cannot save a draft with 3 goals of 33% each sequentially; the first save will fail because the total is not 100%.
    - **Shared Goal Deletion:** Recipients can delete shared goals pushed by admins, violating the "adjust weightage only" constraint.
- **Missing Flows:** Lack of automated role mapping during login.

### 2.2 Adherence to BRD ( 15 / 20 )
**Justification:** Most Phase 1 and 2 requirements are physically present, but their implementation violates the spirit of the BRD in several areas.
- **Implemented:** Max 8 goals, min 10% weightage, shared goal fanout, quarterly achievement logging, manager check-ins.
- **Violations:**
    - **Goal Locking:** The admin unlock flow works, but shared goals are not implicitly locked against deletion by the recipient.
    - **Sync Logic:** Shared goals sync achievements from the primary owner, but the "read-only" constraint is only applied to Title/Target, missing Deletion and Thrust Area.

### 2.3 User Friendliness ( 14 / 20 )
**Justification:** The UI is aesthetically premium, utilizing `oklch` color spaces and smooth transitions (`framer-motion`). However, the "User Friendliness" is severely hampered by backend validation errors that the UI cannot easily resolve (e.g., the weightage total issue).
- **Frontend Architecture:** Excellent use of TanStack Router and React Query. Clear separation of concerns in components.
- **Usability Concerns:** Error toasts for weightage validation will confuse users trying to build their first sheet.

### 2.4 Presence of Bugs ( 8 / 20 )
**Justification:** The project contains a "Grade F" security bug and multiple architectural risks.
- **Critical Bug:** [backend/app/core/middleware.py:25](file:///s:/aqh-samar/backend/app/core/middleware.py#L25) — `jwt.decode(token, "", options={"verify_signature": False})`. This allows anyone to forge an admin token by simply changing the `sub` claim in a JWT.
- **Security Issue:** [backend/app/api/v1/achievements.py:54](file:///s:/aqh-samar/backend/app/api/v1/achievements.py#L54) — "Validation logic for permissions omitted for brevity." In a production audit, "omitted for brevity" is a failure.
- **Race Conditions:** Lack of database-level row locking (`SELECT FOR UPDATE`) during weightage validation allows concurrent goal additions to exceed 100% if timed correctly.

### 2.5 Cost Optimisation ( 10 / 20 )
**Justification:** The system is inefficient at scale.
- **N+1 Queries:** [backend/app/api/v1/reports.py:58-62](file:///s:/aqh-samar/backend/app/api/v1/reports.py#L58-L62) — The report generator executes a separate achievement query for *every* goal in a loop. For 100 employees with 8 goals each, this is 800+ database roundtrips for a single report.
- **Caching:** No backend caching (Redis) for expensive aggregate reports. Frontend React Query uses default stale times (0) for most dynamic data, leading to frequent re-fetching on tab switching.

---

## 3. Bonus Features Evaluation (Additional /100)

### 3.1 Microsoft Entra ID Integration ( 0 / 25 )
- **Verdict:** **Missing.** The system uses standard Supabase email/password auth. No Entra ID/SSO flow was found.

### 3.2 Email & Teams Integration ( 2 / 25 )
- **Verdict:** **Mock Only.** [backend/app/core/notifications.py:8](file:///s:/aqh-samar/backend/app/core/notifications.py#L8) — "stub — logs to stdout only." No async handling or real integration.

### 3.3 Escalation Module ( 8 / 25 )
- **Verdict:** **Shallow.** A single `/escalations` endpoint exists that queries for old submitted sheets. No rule engine, scheduling logic, or deep-link notification support.

### 3.4 Analytics Module ( 20 / 25 )
- **Verdict:** **Strong.** This is the best-implemented bonus feature. The backend supports multi-format exports (CSV/XLSX) and department-level aggregations. The code for progress computation is robust.

---

## 4. Frontend Architecture Audit
- **Component Structure:** High quality. Proper use of Radix-based UI components (Shadcn).
- **State Management:** Clean usage of `zustand` for auth and TanStack Query for server state.
- **Routing:** TanStack Router implementation is enterprise-grade, with proper type safety and route nesting.
- **TypeScript Quality:** Strong types across the board, although some `any` or `unknown` casts in form handling suggest slight rushing.

---

## 5. Backend Architecture Audit
- **API Design:** Service layer is **missing**. All logic is crammed into API routes, making testing and maintenance difficult.
- **DB Modeling:** Schema is correct and follows BRD, but lacks proper constraints (e.g., `CHECK` constraints for weightage sum).
- **Transaction Safety:** Poor. Multiple `db.add()` calls occur without explicit transaction blocks in complex flows like shared goal fanout.

---

## 6. Security Review
- **JWT Handling:** **Non-functional/Vulnerable.** Bypassing signature verification is an automatic failure in any security review.
- **RBAC:** Implemented via decorators, but inconsistent. Some routes lack the necessary ownership checks (e.g., viewing other users' achievements).
- **Sensitive Data:** Exposure of internal UUIDs is fine, but lack of rate limiting on the `/auth/login` endpoint exposes the system to brute force.

---

## 7. Production Readiness Verdict
**Categorization: Fragile Demo**
**Reasoning:** The portal looks like a finished product but behaves like a prototype. The combination of the **JWT signature bypass** and the **N+1 query performance** issues means the system would fail both a security audit and a load test within minutes of launch.

---

## 8. Final Scores

**BASE SCORE:**
- Functionality: 12/20
- BRD Adherence: 15/20
- User Friendliness: 14/20
- Presence of Bugs: 8/20
- Cost Optimisation: 10/20

**TOTAL BASE SCORE: 59/100**

**BONUS SCORE:**
- Entra ID: 0/25
- Teams Integration: 2/25
- Escalation Module: 8/25
- Analytics Module: 20/25

**TOTAL BONUS SCORE: 30/100**

**COMBINED INFORMATIONAL TOTAL: 89/200**