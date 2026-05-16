You are a senior full-stack engineer. Your only job in this session is to close 
specific gaps identified by an audit against docs/base_prompt.md. Do not refactor 
working code. Do not rewrite files that are not listed below. Touch only what 
is specified. Output full file contents for every file you modify or create.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read these files before writing anything:
  docs/base_prompt.md
  backend/app/main.py
  backend/app/core/utils.py
  backend/app/core/responses.py
  backend/app/api/v1/goals.py
  backend/app/api/v1/achievements.py
  backend/app/api/v1/reports.py
  frontend/src/pages/employee/MyGoalsPage.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 1 — write_audit_log helper missing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/core/audit.py (CREATE NEW)

Implement:
  async def write_audit_log(
      session: AsyncSession,
      goal_id: uuid.UUID,
      changed_by: uuid.UUID,
      field_name: str,
      old_value: str,
      new_value: str,
  ) -> None

- Inserts a row into audit_logs with changed_at = utcnow()
- Commits within the same session passed in — do not open a new session
- Import and use the AuditLog model from app/models

► COMMIT: "fix: add write_audit_log helper to core/audit.py"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 2 — notify_manager stub missing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/core/notifications.py (CREATE NEW)

Implement:
  async def notify_manager(
      manager_id: uuid.UUID,
      event: str,
      payload: dict,
  ) -> None:
      # stub — logs to stdout only
      # wired to Teams/email in bonus phase
      print(f"[NOTIFY] manager={manager_id} event={event} payload={payload}")
      return None

► COMMIT: "fix: add notify_manager stub to core/notifications.py"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 3 — cycle window guard not applied to achievements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/core/utils.py

The function is_window_open(cycle, action_type) exists but the action_type 
branch is stubbed with pass. Complete it:

- action_type "goal_setting" → check cycle.phase == "goal_setting" and 
  today is between cycle.window_open and cycle.window_close
- action_type "q1" | "q2" | "q3" | "q4" → check cycle.phase matches the 
  quarter string and today is within window
- action_type None or unrecognised → check only that today is within 
  cycle.window_open and cycle.window_close regardless of phase
- Return True if open, False otherwise. No exceptions raised here.

File: backend/app/api/v1/achievements.py

On POST /achievements and PATCH /achievements/{id}:
- Fetch the active cycle via the DB before writing
- Call is_window_open(cycle, action_type=achievement.quarter.lower())
- If False: raise HTTPException(status_code=422, detail=err("WINDOW_CLOSED",
  f"Check-in window for {achievement.quarter} is not currently open").dict())
- If no active cycle found: raise 422 with code NO_ACTIVE_CYCLE

► COMMIT: "fix: enforce cycle window guard on achievement write endpoints"
✦ TEST: with cycle window closed (set window_close to yesterday in DB), 
  POST /achievements → must return 422 with code WINDOW_CLOSED; 
  open the window → POST succeeds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 4 — weightage validator not enforced on goal writes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/core/validators.py (CREATE NEW)

Implement:
  def validate_weightage(goals: list) -> list[str]:
    errors = []
    total = sum(g.weightage for g in goals)
    if round(total, 2) != 100.0:
        errors.append(f"Total weightage is {total}% — must equal exactly 100%")
    for g in goals:
        if g.weightage < 10:
            errors.append(f"Goal '{g.title}' has weightage {g.weightage}% — minimum is 10%")
    if len(goals) > 8:
        errors.append(f"{len(goals)} goals found — maximum is 8")
    return errors

File: backend/app/api/v1/goals.py

On POST /goals (add a goal to a sheet):
- After inserting the new goal (but before committing), fetch all goals 
  for that sheet from DB
- Call validate_weightage(all_goals)
- If errors list is non-empty: rollback and raise HTTPException(422, 
  detail=err("WEIGHTAGE_INVALID", "Weightage validation failed", 
  details=errors).dict())
- Only commit if validation passes

On PATCH /goals/{id} (edit a goal):
- After applying the update (but before committing), fetch all goals 
  for that sheet
- Same validate_weightage call and rollback-on-fail logic as above

► COMMIT: "fix: enforce weightage validator on goal create and update"
✦ TEST: add a goal with weightage 5% → 422 with WEIGHTAGE_INVALID; 
  add goals totalling 110% → 422; valid set totalling 100% → 200

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 5 — audit log not written on post-lock goal changes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/api/v1/goals.py

On PATCH /goals/{id}:
- Before applying the update, read the current field values for every 
  field being changed
- After committing the update, check goal.is_locked — if True, call 
  write_audit_log() once per changed field:
    field_name = the column name as a string
    old_value  = str(old value)
    new_value  = str(new value)
    changed_by = request.state.user.id
- Import write_audit_log from app.core.audit

► COMMIT: "fix: write audit log entries on post-lock goal mutations"
✦ TEST: admin unlocks a goal via POST /admin/unlock/{goal_id}, then 
  PATCHes the title → GET /reports/audit/{goal_id} must return one 
  entry with field_name="title", correct old and new values

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 6 — GET /reports/achievement missing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/api/v1/reports.py

Implement GET /reports/achievement:
- require_roles("manager", "admin")
- Query params: department_id (optional UUID), cycle_id (optional UUID), 
  status (optional str), format (optional, "csv" | "xlsx", default "xlsx")
- Join: users → goal_sheets → goals → achievements
- Filter by query params if provided; default to active cycle if cycle_id omitted
- Columns in output:
    Employee Name, Employee Email, Department, Goal Title, Thrust Area,
    UoM Type, Target, Q1 Actual, Q2 Actual, Q3 Actual, Q4 Actual,
    Q1 Status, Q2 Status, Q3 Status, Q4 Status, Weightage
- For xlsx: use openpyxl, write to BytesIO, return as StreamingResponse 
  with media_type "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  and header Content-Disposition: attachment; filename="achievement_report.xlsx"
- For csv: use Python csv module, write to StringIO, return as StreamingResponse 
  with media_type "text/csv"
- If no data found: return 200 with empty file (headers row only), not 404

► COMMIT: "feat: implement GET /reports/achievement with xlsx and csv export"
✦ TEST: seed at least 2 employees with goals and Q1 actuals logged; 
  download as xlsx — open in Excel, confirm all columns present and 
  data matches DB; download as csv — confirm parseable with correct headers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 7 — GET /reports/completion missing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/api/v1/reports.py

Implement GET /reports/completion:
- require_roles("manager", "admin")
- Query params: cycle_id (optional UUID, defaults to active cycle), 
  quarter (optional, Q1|Q2|Q3|Q4)
- Returns JSON: list of objects, one per employee:
    {
      employee_id, employee_name, manager_name,
      sheet_status,
      checkins_completed: int,   ← count of checkin rows for this sheet
      checkins_pending: int,     ← (4 - completed) or per quarter if filtered
      last_checkin_at: datetime | null
    }
- Manager role: scoped to their direct reports only
- Admin role: all employees
- Response wrapped in standard { data: [...], error: null } shape

Add CompletionSummaryResponse schema to app/schemas/reports.py (create 
file if it does not exist)

► COMMIT: "feat: implement GET /reports/completion dashboard endpoint"
✦ TEST: with 4 employees, 2 having check-ins logged for Q1 and 2 not — 
  GET /reports/completion?quarter=Q1 must show 2 with checkins_completed=1 
  and 2 with checkins_completed=0; manager-scoped call must only return 
  their direct reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 8 — RequestValidationError not overridden in main.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: backend/app/main.py

Add a global exception handler so FastAPI's default 422 responses 
conform to the project's { data, error } shape:

  from fastapi.exceptions import RequestValidationError
  from fastapi.responses import JSONResponse

  @app.exception_handler(RequestValidationError)
  async def validation_exception_handler(request, exc):
      return JSONResponse(
          status_code=422,
          content={
              "data": None,
              "error": {
                  "code": "VALIDATION_ERROR",
                  "message": "Request validation failed",
                  "details": exc.errors(),
              }
          }
      )

► COMMIT: "fix: override RequestValidationError to match standard error shape"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 9 — frontend weightage validator incomplete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: frontend/src/utils/validateWeightage.ts (CREATE NEW)

  export interface WeightageError {
    rule: string;
    message: string;
  }

  export function validateWeightage(
    goals: { title: string; weightage: number }[]
  ): WeightageError[] {
    const errors: WeightageError[] = [];
    const total = goals.reduce((sum, g) => sum + g.weightage, 0);
    if (Math.round(total * 100) / 100 !== 100) {
      errors.push({ rule: "TOTAL", message: `Total is ${total}% — must equal 100%` });
    }
    goals.forEach((g) => {
      if (g.weightage < 10) {
        errors.push({ rule: "MIN", message: `"${g.title}" is ${g.weightage}% — minimum 10%` });
      }
    });
    if (goals.length > 8) {
      errors.push({ rule: "MAX_GOALS", message: `${goals.length} goals — maximum is 8` });
    }
    return errors;
  }

File: frontend/src/pages/employee/MyGoalsPage.tsx

- Import validateWeightage from utils/validateWeightage
- Import useQuery and useMutation from @tanstack/react-query; replace all 
  raw useEffect + api.get/post calls with React Query hooks
- In the addGoal handler, before calling the API:
    const allGoals = [...existingGoals, newGoal]
    const errors = validateWeightage(allGoals)
    if (errors.length > 0) {
      setValidationErrors(errors)   ← render these inline, not just console
      return
    }
- Add a validationErrors state (WeightageError[]) rendered as a styled 
  error list below the goal form, cleared on successful submit
- The submit button must be disabled when validateWeightage(currentGoals) 
  returns any errors

► COMMIT: "fix: live weightage validator and React Query in MyGoalsPage"
✦ TEST: in the UI add a goal with weightage 5% — error renders inline 
  before any API call is made; add goals summing to 110% — submit button 
  is disabled; valid set — submit enabled and API called once

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL STEP — full regression check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all gaps are closed, run through every manual test checkpoint 
from docs/base_prompt.md in order (Phase 1 through Phase 10) and confirm 
each is now PASSABLE. Report any that are still blocked with the exact 
reason.

► COMMIT: "fix: close all audit gaps — weightage, window guard, reports, audit log"