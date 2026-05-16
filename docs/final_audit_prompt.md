You are a senior product engineer performing a strict compliance audit.
Your job is to cross-reference the PRD against the actual implemented 
frontend and backend code and produce an exhaustive gap report. Do not 
suggest fixes yet. Audit and report only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — READ ALL SOURCE DOCUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read these documents in full before doing anything else:

  docs/prd.docx          ← the Product Requirements Document
  docs/prblm.docx        ← the original hackathon problem statement
                            (this is the evaluation rubric — score 
                            against this above everything else)
  docs/base_prompt.md    ← the build prompt with route and schema specs

Then read every implemented file:

  Backend:
    backend/app/main.py
    backend/app/core/config.py
    backend/app/core/middleware.py
    backend/app/core/utils.py
    backend/app/core/validators.py
    backend/app/core/audit.py
    backend/app/core/notifications.py
    backend/app/core/responses.py
    backend/app/db/base.py
    backend/app/models/*.py
    backend/app/schemas/*.py
    backend/app/api/v1/*.py
    backend/migrations/versions/*.py
    backend/scripts/seed.py

  Frontend:
    frontend/src/main.tsx
    frontend/src/App.tsx
    frontend/src/router.tsx (or equivalent routing file)
    frontend/src/api/*.ts
    frontend/src/pages/**/*.tsx
    frontend/src/components/**/*.tsx
    frontend/src/utils/*.ts
    frontend/src/hooks/*.ts (if present)
    frontend/src/types/*.ts (if present)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — BUILD YOUR INTERNAL CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing the report, internally extract and list every requirement 
from prblm.docx and prd.docx. Organise them into these categories:

  A. User roles and their permitted actions
  B. Goal sheet rules (validation, weightage, limits)
  C. Approval workflow states and transitions
  D. Shared goal behaviour
  E. Achievement tracking rules (quarters, UoM scoring, status values)
  F. Manager check-in rules
  G. Cycle window enforcement
  H. Report and export requirements
  I. Audit trail requirements
  J. Admin capabilities
  K. UI/UX requirements (pages, forms, dashboards stated in PRD)
  L. Evaluation criteria from prblm.docx (these are the judge's rubric —
     treat every item here as P0, non-negotiable)

For each item, note its source (PRD section X, prblm.docx section Y) so 
the report traces back to the original requirement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — PRODUCE THE GAP REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output the full report in this exact structure:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION A — ROLE & ACCESS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each role (Employee, Manager, Admin):
  List every action the PRD says this role can perform.
  For each action state:
    BACKEND: IMPLEMENTED | PARTIAL | MISSING
      → if partial or missing: which file, which function, what is wrong
    FRONTEND: IMPLEMENTED | PARTIAL | MISSING
      → if partial or missing: which page/component, what the user cannot do
    MISALIGNED: yes/no
      → if yes: describe the mismatch between backend capability and 
        frontend surface (e.g. backend enforces it, frontend never calls it)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION B — GOAL SHEET & VALIDATION GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check every validation rule stated in the PRD:
  - Total weightage = 100%
  - Min weightage per goal = 10%
  - Max goals per sheet = 8
  - Min goals per sheet (if stated)
  - Thrust area must be selected (if stated)
  - UoM type must be one of the four valid values
  - Target must be a positive number
  - Goal title and description required fields

For each rule:
  BACKEND enforced: yes/no → file and line where it is enforced or absent
  FRONTEND enforced: yes/no → component where inline validation runs or is absent
  Error message surfaced to user: yes/no → what the user actually sees vs what PRD expects
  PRD source: section reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION C — APPROVAL WORKFLOW GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Map every state transition from the PRD:
  draft → submitted
  submitted → approved
  submitted → rework
  rework → submitted (resubmit)
  approved → locked (goals)
  locked → unlocked (admin only)

For each transition:
  BACKEND: does the route exist, does it enforce the correct prior state, 
    does it produce the correct side effects (lock goals, write audit, 
    notify manager)
  FRONTEND: does the UI surface this transition to the correct role, 
    is the button/action present, does it call the correct endpoint, 
    does it handle the response correctly
  MISALIGNED: backend implements but frontend never triggers, or frontend 
    shows action that backend rejects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION D — SHARED GOALS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD requirements for shared goals:
  - Admin can push a KPI to multiple employees simultaneously
  - Recipients can adjust weightage only — title and target are read-only
  - Achievement updates by the primary owner sync to all linked rows
  - shared_from FK set on recipient goal rows

For each requirement:
  BACKEND: IMPLEMENTED | PARTIAL | MISSING → file, function, issue
  FRONTEND: IMPLEMENTED | PARTIAL | MISSING → page, component, issue
  MISALIGNED: describe if backend and frontend are out of sync

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION E — ACHIEVEMENT TRACKING GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check every achievement requirement:
  - Q1, Q2, Q3, Q4 actuals can be logged independently
  - Status per quarter: Not Started / On Track / Completed
  - Computed progress score per UoM type:
      Min (Numeric/%): Achievement ÷ Target
      Max (Numeric/%): Target ÷ Achievement
      Timeline: completion date vs deadline logic
      Zero: if actual = 0 → 100%, else 0%
  - Score is returned in API response
  - Score displayed in frontend
  - Writes rejected outside cycle window

For each requirement:
  BACKEND: IMPLEMENTED | PARTIAL | MISSING → exact function and any formula errors
  FRONTEND: IMPLEMENTED | PARTIAL | MISSING → where score is or is not shown
  FORMULA CORRECT: yes/no → if no, show the implemented formula vs the correct one

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION F — CHECK-IN GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD requirements:
  - Manager can add a structured comment per sheet per quarter
  - Check-in is tied to a quarter (Q1/Q2/Q3/Q4)
  - Check-in visible to the employee whose sheet it is on
  - Check-in window enforced (cannot write outside active window)
  - Manager dashboard shows which employees have/have not had a check-in

For each requirement:
  BACKEND: IMPLEMENTED | PARTIAL | MISSING
  FRONTEND: IMPLEMENTED | PARTIAL | MISSING
  MISALIGNED: yes/no with description

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION G — CYCLE & WINDOW ENFORCEMENT GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD specifies these phases and windows:
  Phase 1 (Goal Setting): opens May 1
  Q1 Check-in: July
  Q2 Check-in: October
  Q3 Check-in: January
  Q4 / Annual: March / April

For each window:
  Is it configurable in the DB (cycle table)?: yes/no
  Is window_open and window_close actually enforced on writes?: 
    → list every write endpoint and whether it checks the window
  Does the frontend show the current phase/window to the user?: yes/no
  Does the frontend disable write actions when window is closed?: yes/no

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION H — REPORTS & EXPORTS GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD requires:
  Achievement Report:
    - Exportable in CSV and Excel
    - Columns: Employee Name, Email, Department, Goal Title, Thrust Area, 
      UoM Type, Target, Q1–Q4 Actuals, Q1–Q4 Status, Weightage
    - Filterable by department, manager, period, status
  Completion Dashboard:
    - Real-time: who has/has not completed quarterly check-ins
    - Visible to managers and admins
  Audit Trail:
    - Per goal_id — all post-lock changes
    - Fields: who changed what, old value, new value, timestamp
    - Admin/HR only

For each report:
  BACKEND endpoint: IMPLEMENTED | PARTIAL | MISSING
  Correct columns/fields: yes/no → list any missing or wrong columns
  Filters working: yes/no → list any missing filter params
  FRONTEND surface: IMPLEMENTED | PARTIAL | MISSING
    → is there a page/button the user can reach to trigger this?
  Export format correct: yes/no

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION I — AUDIT TRAIL GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD requires audit entries written for:
  - Any goal field change after is_locked = true
  - Admin unlock action
  - Sheet status transitions (submitted, approved, rework)

For each trigger:
  Is write_audit_log called at this point?: yes/no
  File and function where it is or should be called
  Fields captured: goal_id, changed_by, field_name, old_value, new_value, changed_at
  All fields present in the written entry?: yes/no

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION J — ADMIN CAPABILITY GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD requires admin to:
  - Configure cycles (create, open, close windows)
  - Manage org hierarchy (assign manager_id)
  - View completion rates across the org
  - Exception handling: unlock a goal post-approval
  - Push shared goals to multiple employees
  - View escalations (employees/managers who are overdue)

For each capability:
  BACKEND: IMPLEMENTED | PARTIAL | MISSING
  FRONTEND admin panel: IMPLEMENTED | PARTIAL | MISSING
  Is it reachable by admin in the UI without API calls?: yes/no

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION K — FRONTEND UI/UX GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD specifies these pages/views must exist:
  Employee:
    - My Goals page (list of goal sheets with status)
    - Goal Sheet form (create goals, set weightage, UoM, thrust area, target)
    - Achievement entry form (per quarter, per goal)
    - View check-in comments from manager
  Manager:
    - Team dashboard (all direct reports with sheet status)
    - Goal sheet review page (inline edit targets/weightages, approve/return)
    - Check-in form (add comment per employee per quarter)
    - Completion overview (who has/has not submitted/been checked in)
  Admin:
    - Cycle management page (create/edit cycles, set windows)
    - User management (assign managers, departments)
    - Shared goal push form (select KPI, select employees, set)
    - Escalations view
    - Reports/export page

For each page:
  EXISTS: yes/no → file path if yes
  COMPLETE: yes/no → list any missing fields, actions, or data that the 
    PRD says should be there but is not rendered
  CONNECTED TO BACKEND: yes/no → are all API calls wired, do they use 
    the correct endpoints, are responses handled and displayed
  ROLE GUARD: yes/no → is this page inaccessible to wrong roles

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION L — EVALUATION RUBRIC COMPLIANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This section is the most critical. Extract every evaluation criterion 
from prblm.docx. These are what the judges will score against.

For each criterion from prblm.docx:
  Criterion text: (exact wording from document)
  Source: prblm.docx section/page
  Status: FULLY MET | PARTIALLY MET | NOT MET
  Evidence: 
    → if FULLY MET: which file/page/endpoint proves it
    → if PARTIALLY MET: what is done and what is missing
    → if NOT MET: what needs to be built from scratch
  Risk to score: HIGH | MEDIUM | LOW

Order these from highest risk to lowest.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION M — MISALIGNMENT MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

List every case where backend and frontend are out of sync — meaning the 
backend has a capability the frontend never surfaces, or the frontend 
attempts something the backend does not support.

Format each as:
  MISALIGNMENT: [short name]
  Backend:  [what the backend does or exposes]
  Frontend: [what the frontend does or expects]
  Impact:   [what breaks or is invisible to the user]
  PRD req:  [which PRD requirement this affects]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION N — PRIORITY FIX LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Combine all gaps from sections A–M into a single ordered list.
Order by:
  1. Evaluation rubric risk (prblm.docx criteria) — always first
  2. Core user journey breakage (something the judge would demo that fails)
  3. Data integrity (audit, locking, validation)
  4. Cosmetic or completeness issues

For each item:
  [PRIORITY: P0/P1/P2] [Section ref] File or page — gap description — 
  user-visible impact

P0 = judge will see this fail during demo
P1 = core feature broken but may not be immediately visible in a demo
P2 = incomplete but does not break the main user journey

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION O — SUMMARY SCORECARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Evaluation criteria from prblm.docx:   X fully met / Y total
  PRD sections fully implemented:         X / Y
  Backend endpoints correct:              X / Y
  Frontend pages complete and wired:      X / Y
  Backend–frontend misalignments:         X
  P0 issues (demo-breaking):              X
  P1 issues (core feature broken):        X
  P2 issues (completeness):               X
  Estimated scoring risk:                 HIGH / MEDIUM / LOW

Do not write any code. Do not suggest implementations. 
Audit and report only. Be exhaustive — a gap missed here 
costs points at judging.