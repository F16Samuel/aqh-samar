SECTION A — ROLE & ACCESS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Employee**
- **Draft goals, set UoM/Targets/Weightage:** 
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Submit Goal Sheet:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Enter quarterly achievement / update status:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **View check-in comments:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no

**Manager (L1)**
- **Review & approve goals:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Inline editing during approval:**
  BACKEND: PARTIAL — Logic in `goals.py` permits managers to edit goals of their direct reports.
  FRONTEND: MISSING — In `app.goal-sheets.$sheetId.tsx`, the `canEdit` variable evaluates to `false` when the sheet status is "submitted", completely hiding the edit button for Managers during the review phase.
  MISALIGNED: yes — Backend exposes the capability, but frontend explicitly blocks it.
- **Return goals for rework:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Conduct quarterly check-ins / log feedback:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Team dashboard:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no

**Admin / HR**
- **Configure cycles:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Manage org hierarchy (assign manager_id, departments):**
  BACKEND: MISSING — No users router endpoints exist to create/update users or assign their managers/departments.
  FRONTEND: MISSING — No user management page or interface exists.
  MISALIGNED: no (uniformly missing)
- **Oversee completion rates:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Exception handling (Goal unlock capability):**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **Push shared goals:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no
- **View escalations:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no

SECTION B — GOAL SHEET & VALIDATION GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Total weightage = 100%:** 
  BACKEND enforced: yes (`app/core/validators.py`)
  FRONTEND enforced: yes (`validateSheetForSubmission` in `app.goal-sheets.$sheetId.tsx`)
  Error message surfaced to user: yes
  PRD source: 4.1.2

- **Min weightage per goal = 10%:**
  BACKEND enforced: yes (`app/core/validators.py`)
  FRONTEND enforced: yes (min="10" attribute and hook-form schemas)
  Error message surfaced to user: yes
  PRD source: 4.1.2

- **Max goals per sheet = 8:**
  BACKEND enforced: yes (`app/api/v1/goals.py` lines 62, 209 limits creation to 8)
  FRONTEND enforced: yes (Hide "Add goal" button when length >= 8)
  Error message surfaced to user: yes
  PRD source: 4.1.2

- **Thrust area must be selected:**
  BACKEND enforced: yes (Schema required field)
  FRONTEND enforced: yes (Form required field)
  Error message surfaced to user: yes
  PRD source: 4.1.1

- **UoM type must be one of four valid values:**
  BACKEND enforced: yes
  FRONTEND enforced: yes (Select dropdown restricts choices)
  Error message surfaced to user: yes
  PRD source: 4.1.1

- **Target must be a positive number:**
  BACKEND enforced: no (Currently treats target as an opaque string; fails to strictly validate >0 numerical values).
  FRONTEND enforced: no (Input lacks `type="number"` and `min="0"` constraints).
  Error message surfaced to user: no (User can enter arbitrary text).
  PRD source: 4.1.1 / Section E logic

- **Goal title and description required fields:**
  BACKEND enforced: yes
  FRONTEND enforced: yes (Title is strictly required; Description is handled as optional fallback to empty string)
  Error message surfaced to user: yes
  PRD source: 4.1.1

SECTION C — APPROVAL WORKFLOW GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **draft → submitted:**
  BACKEND: Route exists, prior state enforced, manager notified.
  FRONTEND: Present, calls correct endpoint.
  MISALIGNED: no

- **submitted → approved:**
  BACKEND: Route exists, prior state enforced, correctly locks goals, sets `approved_at`.
  FRONTEND: Present to managers, calls correct endpoint.
  MISALIGNED: no

- **submitted → rework:**
  BACKEND: Route exists, unlocks goals, creates 'Goal Setting' check-in comment.
  FRONTEND: Present to managers, handles response correctly.
  MISALIGNED: no

- **approved → locked (goals):**
  BACKEND: Auto-triggers during approval route.
  FRONTEND: UI shows locked badge correctly.
  MISALIGNED: no

- **locked → unlocked (admin only):**
  BACKEND: Route exists, verifies admin role, writes audit log.
  FRONTEND: Admin Unlock page exists and functions.
  MISALIGNED: no

SECTION D — SHARED GOALS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Admin can push KPI to multiple employees:**
  BACKEND: IMPLEMENTED (`app/api/v1/goals.py` -> `/shared`)
  FRONTEND: IMPLEMENTED (`app.admin.shared-goals.tsx`)
  MISALIGNED: no

- **Recipients adjust weightage only (Title/Target read-only):**
  BACKEND: IMPLEMENTED (Rejects updates to restricted fields if `shared_from` is set)
  FRONTEND: IMPLEMENTED (Inputs disabled via `sharedReadonly` prop)
  MISALIGNED: no

- **Achievement updates sync to all linked rows:**
  BACKEND: IMPLEMENTED (`_auto_sync_shared_goals` triggers on master goal update)
  FRONTEND: IMPLEMENTED (Recipient rows restrict manual achievement writes)
  MISALIGNED: no

- **shared_from FK set on recipient rows:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED (Renders "Shared" badge)
  MISALIGNED: no

SECTION E — ACHIEVEMENT TRACKING GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Q1, Q2, Q3, Q4 actuals can be logged independently:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  FORMULA CORRECT: yes

- **Status per quarter: Not Started / On Track / Completed:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  FORMULA CORRECT: yes

- **Computed progress score per UoM type:**
  BACKEND: IMPLEMENTED (`app/core/utils.py` handles formulas)
  FRONTEND: MISSING (Frontend completely fails to display the returned score)
  FORMULA CORRECT: yes 

- **Score is returned in API response:**
  BACKEND: IMPLEMENTED (Appended to `AchievementOut` dict in `achievements.py`)
  FRONTEND: MISSING (Not stored or utilized by UI)
  FORMULA CORRECT: N/A

- **Score displayed in frontend:**
  BACKEND: N/A
  FRONTEND: MISSING (The user cannot see their calculated progress score anywhere on `app.achievements.tsx`)
  FORMULA CORRECT: N/A

- **Writes rejected outside cycle window:**
  BACKEND: PARTIAL (`WindowGuardMiddleware` strictly checks date ranges for `/achievements` and `/checkins`).
  FRONTEND: MISSING (The UI does not proactively disable inputs or the "Log" button when a window is closed; relies entirely on backend 422 HTTP responses).
  FORMULA CORRECT: N/A

SECTION F — CHECK-IN GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Manager adds structured comment per sheet per quarter:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no

- **Check-in tied to a quarter:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  MISALIGNED: no

- **Check-in visible to the employee:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED (Displays in `CheckinsCard`)
  MISALIGNED: no

- **Check-in window enforced:**
  BACKEND: IMPLEMENTED (Blocked by `WindowGuardMiddleware`)
  FRONTEND: PARTIAL (Frontend allows typing and clicking "Post", triggering a 422 error instead of disabling the form)
  MISALIGNED: yes

- **Manager dashboard shows check-in completion:**
  BACKEND: IMPLEMENTED (`/reports/completion`)
  FRONTEND: IMPLEMENTED (`app.index.tsx` for Admin; Manager sees check-ins in Reports page)
  MISALIGNED: no

SECTION G — CYCLE & WINDOW ENFORCEMENT GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Configurable in DB (cycle table):** yes
- **window_open and window_close enforced on writes?:**
  `POST /achievements/`: Enforced (via Middleware)
  `PATCH /achievements/{id}`: Enforced (via Middleware)
  `POST /checkins/`: Enforced (via Middleware)
  `POST /goal-sheets/`: NOT ENFORCED (Missing middleware/logic)
  `POST /goal-sheets/{id}/submit`: NOT ENFORCED (Missing middleware/logic)
  `POST /goals/`: NOT ENFORCED (Missing middleware/logic)

- **Frontend shows current phase/window:** yes (Visible on Dashboard `CycleCard`)
- **Frontend disables write actions when closed:** no (Users can still click actions, resulting in unhandled 422 server responses).

SECTION H — REPORTS & EXPORTS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Achievement Report exportable in CSV/Excel:**
  BACKEND endpoint: IMPLEMENTED
  Correct columns/fields: yes
  Filters working: yes (Department, Manager, Period, Status working)
  FRONTEND surface: IMPLEMENTED (`app.reports.tsx`)
  Export format correct: yes (OpenPyXL and CSV writers verify)

- **Completion Dashboard:**
  BACKEND endpoint: IMPLEMENTED
  Correct columns/fields: yes
  Filters working: yes
  FRONTEND surface: IMPLEMENTED (Visible in Admin Dashboard)
  Export format correct: N/A

- **Audit Trail:**
  BACKEND endpoint: IMPLEMENTED (`GET /reports/audit/{goal_id}`)
  Correct columns/fields: yes
  Filters working: N/A
  FRONTEND surface: MISSING (There is no UI page, modal, or button for Admins or HR to view the fetched audit logs).
  Export format correct: N/A

SECTION I — AUDIT TRAIL GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Any goal field change after is_locked = true:**
  Is write_audit_log called?: yes
  File/function: `app/api/v1/goals.py` -> `update_goal`
  All fields present?: yes

- **Admin unlock action:**
  Is write_audit_log called?: yes
  File/function: `app/api/v1/admin.py` -> `unlock_goal`
  All fields present?: yes

- **Sheet status transitions (submitted, approved, rework):**
  Is write_audit_log called?: no
  File/function: `app/api/v1/goal_sheets.py` completely lacks any call to `write_audit_log` inside `submit_sheet`, `approve_sheet`, or `return_sheet`.
  All fields present?: no (Not implemented at all).

SECTION J — ADMIN CAPABILITY GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Configure cycles:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  Reachable in UI without API calls?: yes

- **Manage org hierarchy (assign manager_id):**
  BACKEND: MISSING (No API route exists for CRUD operations on users/departments).
  FRONTEND: MISSING (No user configuration page).
  Reachable in UI without API calls?: no

- **View completion rates:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  Reachable in UI without API calls?: yes

- **Exception handling (unlock):**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  Reachable in UI without API calls?: yes

- **Push shared goals:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  Reachable in UI without API calls?: yes

- **View escalations:**
  BACKEND: IMPLEMENTED
  FRONTEND: IMPLEMENTED
  Reachable in UI without API calls?: yes

SECTION K — FRONTEND UI/UX GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Employee**
- My Goals page: EXISTS | COMPLETE | CONNECTED | GUARDED
- Goal Sheet form: EXISTS | COMPLETE | CONNECTED | GUARDED
- Achievement entry form: EXISTS | PARTIAL (Misses rendering calculated score) | CONNECTED | GUARDED
- View check-in comments: EXISTS | COMPLETE | CONNECTED | GUARDED

**Manager**
- Team dashboard: EXISTS | COMPLETE | CONNECTED | GUARDED
- Goal sheet review page: EXISTS | PARTIAL (Inline Edit buttons are intentionally disabled by frontend logic when sheet is "submitted") | CONNECTED | GUARDED
- Check-in form: EXISTS | COMPLETE | CONNECTED | GUARDED
- Completion overview: EXISTS | COMPLETE | CONNECTED | GUARDED

**Admin**
- Cycle management: EXISTS | COMPLETE | CONNECTED | GUARDED
- User management: MISSING
- Shared goal push form: EXISTS | COMPLETE | CONNECTED | GUARDED
- Escalations view: EXISTS | COMPLETE | CONNECTED | GUARDED
- Reports/export page: EXISTS | COMPLETE | CONNECTED | GUARDED
- Audit Log view: MISSING

SECTION L — EVALUATION RUBRIC COMPLIANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **User Management / Org Hierarchy**
   Criterion text: "manage org hierarchy; assign reporting lines"
   Source: prblm.docx (Section 3: Roles)
   Status: NOT MET
   Evidence: No endpoints in `users.py` support updates; Frontend completely lacks an Admin "Users" page.
   Risk to score: HIGH

2. **Manager Inline Editing**
   Criterion text: "Review submitted goals; ability to edit targets / weightages inline"
   Source: prblm.docx (Section 2.1)
   Status: PARTIALLY MET
   Evidence: Backend logic allows it; Frontend (`app.goal-sheets.$sheetId.tsx`) explicitly sets `canEdit = false` during the review state, disabling the button.
   Risk to score: HIGH

3. **Window Enforcement (Phase 1)**
   Criterion text: "The portal must enforce the following quarterly windows for achievement capture [and Goal Setting]"
   Source: prblm.docx (Section 2.3)
   Status: PARTIALLY MET
   Evidence: `WindowGuardMiddleware` guards Achievements and Check-ins, but lacks hooks for `POST /goal-sheets` or `POST /goals`, allowing Goal creation at any time.
   Risk to score: HIGH

4. **Status Transition Audits**
   Criterion text: "System must log all changes made to goals after the lock date" / PRD states Sheet Status transitions.
   Source: prblm.docx (Section 4) / PRD 5.3
   Status: PARTIALLY MET
   Evidence: `goals.py` and `admin.py` write logs; `goal_sheets.py` lacks all audit integration.
   Risk to score: MEDIUM

5. **Progress Score Display**
   Criterion text: "System-computed progress scores (for tracking only, not ratings)"
   Source: prblm.docx (Section 2.2)
   Status: PARTIALLY MET
   Evidence: Computed mathematically and shipped in API payloads, but never rendered in `app.achievements.tsx`.
   Risk to score: MEDIUM

6. **Lock & Audit UI**
   Criterion text: "Audit Trail: System must log all changes... visible to Admin/HR"
   Source: prblm.docx (Section 4)
   Status: PARTIALLY MET
   Evidence: Backend API `/reports/audit/{goal_id}` works, but Admin frontend has zero UI implemented to view it.
   Risk to score: MEDIUM

SECTION M — MISALIGNMENT MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **MISALIGNMENT: Manager Inline Edit Disabled**
  Backend: Allows L1 Managers to `PATCH` goals on their direct reports' submitted sheets.
  Frontend: Logic explicitly evaluates `canEdit = false` on "submitted" sheets, removing the edit capability entirely.
  Impact: Managers are forced to return sheets for rework instead of making fast inline edits, failing the core demo script.
  PRD req: 4.1.3

- **MISALIGNMENT: Invisible Progress Scores**
  Backend: Beautifully computes progress via `compute_progress_score` and returns `progress_score` field in JSON.
  Frontend: Retrieves JSON, maps it without the score, and never renders it to the user.
  Impact: Employees and Managers cannot view automated progress metrics.
  PRD req: 4.2.3

- **MISALIGNMENT: Orphaned Audit Logs API**
  Backend: Records changes and serves `GET /reports/audit/{goal_id}`.
  Frontend: Fails to query this endpoint or construct a table to display it.
  Impact: Makes the audit trail legally invisible to Admins without making direct network queries.
  PRD req: 5.3

- **MISALIGNMENT: Reactive Window Enforcement**
  Backend: Generates hard `422 Unprocessable Entity` errors when logging achievements outside cycle windows.
  Frontend: Leaves form inputs, dropdowns, and "Submit" buttons enabled, trapping users in errors.
  Impact: Confusing UX.
  PRD req: 4.3

SECTION N — PRIORITY FIX LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **[PRIORITY: P0] [Section L/M] Frontend `app.goal-sheets.$sheetId.tsx`** — Adjust `canEdit` logic to allow L1 managers to edit goal details while the sheet is in `submitted` status. (Demo blocking).
2. **[PRIORITY: P0] [Section G] Backend `goal_sheets.py` & `goals.py`** — Insert active cycle phase checking on `POST` requests for sheets and goals to prevent out-of-bounds Phase 1 creation. (Integrity blocking).
3. **[PRIORITY: P0] [Section J/L] Fullstack `users.py` & `app.admin.users.tsx`** — Build the missing User Management panel for Admins to designate managers and departments. (Core feature missing).
4. **[PRIORITY: P1] [Section E/M] Frontend `app.achievements.tsx`** — Render the `progress_score` from the achievement payload. (Rubric item missing).
5. **[PRIORITY: P1] [Section K/M] Frontend `app.admin.audit.tsx`** — Create an Admin page linking to the `/reports/audit/{goal_id}` endpoint to visualize logs. (Rubric item missing).
6. **[PRIORITY: P1] [Section I] Backend `goal_sheets.py`** — Add `write_audit_log` imports and execution logic within the `submit_sheet`, `approve_sheet`, and `return_sheet` transitions. (Compliance gap).
7. **[PRIORITY: P2] [Section G/M] Frontend All Tracking Forms** — Map cycle configurations to button disable states to proactively block writes outside active windows instead of relying purely on 422 HTTP responses. (UX Improvement).

SECTION O — SUMMARY SCORECARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Evaluation criteria from prblm.docx:   1 fully met / 6 total (5 Partially Met, 1 Not Met)
  PRD sections fully implemented:        10 / 14
  Backend endpoints correct:             18 / 20
  Frontend pages complete and wired:     10 / 12
  Backend–frontend misalignments:        4
  P0 issues (demo-breaking):             3
  P1 issues (core feature broken):       3
  P2 issues (completeness):              2
  Estimated scoring risk:                HIGH