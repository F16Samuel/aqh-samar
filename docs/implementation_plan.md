# Resolve Engineering Audit Gaps

This plan addresses the critical P0 and P1 functionality and compliance gaps identified during the strict compliance audit of the AQH-SAMAR Goal Tracking Portal. 

## User Review Required
> [!WARNING]
> This plan includes creating a simple User Management UI to satisfy the Org Hierarchy evaluation rubric. I've opted to add a `PATCH /api/v1/users/{id}` endpoint allowing admins to reassign roles, managers, and departments, rather than full CRUD (the seed script provides users). Please confirm if this is sufficient for the demo.

## Open Questions
> [!IMPORTANT]
> - Should the frontend use the `tanstack-router` CLI to regenerate `routeTree.gen.ts` automatically after adding the new routes, or should I manually update `routeTree.gen.ts`? I will manually update it to avoid tool dependency issues unless you prefer otherwise.

## Proposed Changes

---

### Backend Components

#### [MODIFY] `backend/app/api/v1/goal_sheets.py`
- Enforce the "Goal Setting" window by injecting `is_window_open` checks into `create_goal_sheet` and `submit_sheet`.
- Add `write_audit_log` inside `submit_sheet`, `approve_sheet`, and `return_sheet` to legally capture sheet status transitions for compliance.

#### [MODIFY] `backend/app/api/v1/goals.py`
- Enforce the "Goal Setting" window by injecting `is_window_open` checks into `create_goal` and `delete_goal` routes to prevent out-of-bounds Phase 1 modifications.

#### [MODIFY] `backend/app/api/v1/users.py`
- Add a new `PATCH /{user_id}` route guarded by `@require_roles("admin")`.
- Implement logic to update `role`, `manager_id`, and `department_id` to support Org Hierarchy configurations.

---

### Frontend Components

#### [MODIFY] `frontend/src/routes/app.goal-sheets.$sheetId.tsx`
- **Fix Manager Inline Edit (P0)**: Update the `canEdit` evaluation to evaluate to `true` when the sheet status is `submitted` and the current user's role is `manager`.
- Disable the submit and edit actions proactively when the cycle window is closed, preventing unhandled 422 errors.

#### [MODIFY] `frontend/src/routes/app.achievements.tsx`
- **Show Progress Score (P1)**: Map and render the `progress_score` (returned by the backend payload) inside the `GoalAchievementRow` component to make calculated metrics visible to the user.

#### [NEW] `frontend/src/routes/app.admin.users.tsx`
- **User Management (P0)**: Build an Admin page listing all users from `/users`.
- Add an inline or modal form to assign L1 managers, roles, and departments (consuming the new `PATCH` endpoint).

#### [NEW] `frontend/src/routes/app.admin.audit.tsx`
- **Audit Logs UI (P1)**: Build an Admin page to input a Goal ID and visualize the detailed JSON audit trail returned from `/reports/audit/{goal_id}` in a tabular format.

#### [MODIFY] `frontend/src/routes/app.tsx` & `frontend/src/routeTree.gen.ts`
- Add "User Config" and "Audit Logs" to the Admin sidebar navigation group.
- Register the newly created `app.admin.users.tsx` and `app.admin.audit.tsx` in the file-based router tree manually.

## Verification Plan

### Automated Tests
- None required for this phase. 

### Manual Verification
1. **Manager Inline Edit**: Log in as Manager, open a submitted goal sheet of a direct report, and verify the "Edit" button is now visible and functional.
2. **Window Enforcement**: As an employee, attempt to create a goal sheet while the 'Goal Setting' window is marked closed in the DB. Ensure the UI disables the button and the backend returns a clean validation error if bypassed.
3. **User Management**: Log in as Admin, navigate to "User Config", and successfully assign a manager to an unassigned employee.
4. **Audit Trail**: Transition a goal sheet (Submit -> Approve), then as Admin, view the Audit Log page for one of those goals to confirm the status transition was captured.
5. **Progress Scores**: Log an achievement as an employee and verify the computed progress score (e.g., "75%") appears alongside the entry.
