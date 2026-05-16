Viewed cycle.py:1-32
Viewed goal_sheet.py:1-29
Viewed goal.py:1-42
Viewed achievement.py:1-29
Viewed checkin.py:1-19
Viewed goals.py:1-228

# AQH-SAMAR API Documentation

## Overview
The AQH-SAMAR API is a production-grade employee performance management system. It facilitates goal setting, quarterly achievement tracking, manager check-ins, and automated progress scoring. The service enforces strict business rules regarding goal weightage, cycle-based check-in windows, and role-based access control (RBAC).

## Base URL
`/api/v1`

## Authentication
Authentication is handled via **Supabase Auth (JWT)**.
- **Mechanism**: Bearer Token in `Authorization` header.
- **Validation**: `AuthMiddleware` decodes the JWT and verifies the `sub` against the `users` table.
- **Context**: Validated user profiles are attached to `request.state.user`.

## Global Middleware
1.  **CORSMiddleware**: Handles cross-origin resource sharing.
2.  **AuthMiddleware**: Decodes JWT and attaches `request.state.user`.
3.  **WindowGuardMiddleware**: Enforces check-in windows for `/achievements` and `/checkins`.
4.  **Validation Exception Handler**: Standardizes Pydantic error responses.
5.  **Global Exception Handler**: Standardizes unhandled 500 error responses.

---

## Endpoints

### Authentication (`/auth`)
- **POST `/auth/login`**
  - **Description**: Authenticates the user session.
  - **Input**: `Authorization: Bearer <JWT>` header.
  - **Source**: Frontend.
  - **Response**: `UserOut` (JSON).

- **GET `/auth/me`**
  - **Description**: Retrieves current user profile.
  - **Input**: `Authorization: Bearer <JWT>` header.
  - **Source**: Frontend.
  - **Response**: `UserOut` (JSON).

### User Management (`/users`)
- **GET `/users/`**
  - **Description**: Lists all users.
  - **Authentication**: Admin Only.
  - **Source**: Frontend.
  - **Response**: List of `UserOut`.

- **GET `/users/{user_id}`**
  - **Description**: Retrieves a specific user.
  - **Path Params**: `user_id` (UUID).
  - **Source**: Frontend.
  - **Response**: `UserOut`.

- **GET `/users/{user_id}/team`**
  - **Description**: Lists direct reports.
  - **Path Params**: `user_id` (UUID).
  - **Source**: Frontend.
  - **Response**: List of `UserOut`.

### Cycles (`/cycles`)
- **GET `/cycles/active`**
  - **Description**: Retrieves the active cycle.
  - **Source**: Frontend.
  - **Response**: `CycleOut`.

- **POST `/cycles/`**
  - **Description**: Creates a new cycle.
  - **Authentication**: Admin Only.
  - **Request Body** (`CycleCreate`):
    - `year` (int)
    - `phase` (str)
    - `window_open` (date)
    - `window_close` (date)
    - `is_active` (bool)
  - **Source**: Frontend.

- **PATCH `/cycles/{cycle_id}`**
  - **Description**: Updates a cycle.
  - **Authentication**: Admin Only.
  - **Path Params**: `cycle_id` (UUID).
  - **Request Body** (`CycleUpdate`): Fields are optional.
  - **Source**: Frontend.

### Goal Sheets (`/goal-sheets`)
- **POST `/goal-sheets/`**
  - **Description**: Initializes a draft goal sheet.
  - **Source**: Frontend.
  - **Side Effects**: Implicitly links to active cycle.

- **GET `/goal-sheets/mine`**
  - **Description**: Lists user's sheets.
  - **Source**: Frontend.

- **POST `/goal-sheets/{id}/submit`**
  - **Description**: Submits sheet for review.
  - **Path Params**: `id` (UUID).
  - **Source**: Frontend.
  - **Side Effects**: Calls `notify_manager` (Internal).

- **POST `/goal-sheets/{id}/approve`**
  - **Description**: Approves sheet.
  - **Authentication**: Manager Only.
  - **Path Params**: `id` (UUID).
  - **Source**: Frontend.

- **POST `/goal-sheets/{id}/return`**
  - **Description**: Returns sheet for rework.
  - **Request Body** (`ReturnPayload`): `comment` (str).
  - **Source**: Frontend.

### Goals (`/goals`)
- **POST `/goals/`**
  - **Description**: Adds a goal.
  - **Request Body** (`GoalCreate`):
    - `sheet_id` (UUID)
    - `thrust_area` (str)
    - `title` (str)
    - `description` (str|null)
    - `uom_type` (str: `min`|`max`|`timeline`|`zero`)
    - `target` (str)
    - `weightage` (int)
  - **Source**: Frontend.

- **PATCH `/goals/{goal_id}`**
  - **Description**: Updates a goal.
  - **Path Params**: `goal_id` (UUID).
  - **Request Body** (`GoalUpdate`): Fields are optional.
  - **Source**: Frontend.

- **POST `/goals/shared`**
  - **Description**: Distributes a goal to employees.
  - **Authentication**: Admin Only.
  - **Request Body** (`GoalSharedCreate`):
    - `source_goal_id` (UUID)
    - `employee_ids` (List[UUID])
    - `weightage` (int)
  - **Source**: Frontend.

### Achievements (`/achievements`)
- **POST `/achievements/`**
  - **Description**: Logs achievement.
  - **Request Body** (`AchievementCreate`):
    - `goal_id` (UUID)
    - `quarter` (str)
    - `actual` (str|null)
    - `status` (str)
  - **Source**: Frontend.

- **PATCH `/achievements/{ach_id}`**
  - **Description**: Updates achievement.
  - **Path Params**: `ach_id` (UUID).
  - **Request Body** (`AchievementUpdate`): Fields are optional.
  - **Source**: Frontend.

### Check-ins (`/checkins`)
- **POST `/checkins/`**
  - **Description**: Adds manager comment.
  - **Request Body** (`CheckInCreate`):
    - `sheet_id` (UUID)
    - `quarter` (str)
    - `comment` (str)
  - **Source**: Frontend.

- **GET `/checkins/sheet/{sheet_id}`**
  - **Description**: Lists check-ins.
  - **Path Params**: `sheet_id` (UUID).
  - **Source**: Frontend.

### Reports (`/reports`)
- **GET `/reports/achievement`**
  - **Description**: Downloads report.
  - **Query Params**:
    - `format` (str: `csv`|`xlsx`)
    - `cycle_id` (UUID|null)
    - `department_id` (UUID|null)
  - **Source**: Frontend.

- **GET `/reports/completion`**
  - **Description**: Dashboard data.
  - **Query Params**: `cycle_id` (UUID|null), `quarter` (str|null).
  - **Source**: Frontend.

### Admin (`/admin`)
- **POST `/admin/unlock/{goal_id}`**
  - **Description**: Unlocks a goal.
  - **Path Params**: `goal_id` (UUID).
  - **Source**: Frontend.

- **GET `/admin/escalations`**
  - **Description**: Lists stalled sheets.
  - **Source**: Frontend.

---

## Data Models

### UserOut
- `id` (UUID)
- `email` (str)
- `full_name` (str)
- `role` (str: `employee`|`manager`|`admin`)
- `manager_id` (UUID|null)
- `department_id` (UUID|null)

### GoalOut
- `id` (UUID)
- `sheet_id` (UUID)
- `thrust_area` (str)
- `title` (str)
- `description` (str|null)
- `uom_type` (str)
- `target` (str)
- `weightage` (int)
- `is_locked` (bool)
- `shared_from` (UUID|null)

---

## Error Codes
Standardized Response: `{ "data": null, "error": { "code": str, "message": str, "details": any|null } }`

---

## Architecture Notes
- **WindowGuardMiddleware**: Prevents writes to `/achievements` and `/checkins` by intercepting the request body and validating the `quarter` against the `Cycle` phase.
- **Internal Services**: `notify_manager` and `write_audit_log` are called internally by backend routes to perform background side effects.
- **Front-to-Back Flow**: React Query hooks in the frontend map 1:1 to these API endpoints.