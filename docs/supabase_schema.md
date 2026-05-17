# Supabase Database Schema & Relations Documentation

*Generated on: 2026-05-17 12:12:01*

This document provides a highly detailed schematic of the AQH-SAMAR portal tables, columns, constraints, and relational mappings, along with the physical records exported to JSON files.

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    "achievements" {
        uuid id PK
        uuid goal_id FK
        uuid cycle_id FK
        character varying quarter
        character varying actual
        character varying status
        timestamp without time zone updated_at
    }
    "alembic_version" {
        character varying version_num PK
    }
    "audit_logs" {
        uuid id PK
        uuid goal_id FK
        uuid changed_by FK
        character varying field_name
        character varying old_value
        character varying new_value
        timestamp without time zone changed_at
    }
    "checkins" {
        uuid id PK
        uuid sheet_id FK
        uuid manager_id FK
        character varying quarter
        text comment
        timestamp without time zone created_at
    }
    "cycles" {
        uuid id PK
        integer year
        character varying phase
        date window_open
        date window_close
        boolean is_active
    }
    "departments" {
        uuid id PK
        character varying name
    }
    "goal_sheets" {
        uuid id PK
        uuid employee_id FK
        uuid cycle_id FK
        character varying status
        timestamp without time zone submitted_at
        timestamp without time zone approved_at
        uuid approved_by FK
    }
    "goals" {
        uuid id PK
        uuid sheet_id FK
        uuid shared_from FK
        character varying thrust_area
        character varying title
        text description
        character varying uom_type
        character varying target
        integer weightage
        boolean is_locked
    }
    "users" {
        uuid id PK
        character varying email
        character varying full_name
        character varying role
        uuid manager_id FK
        uuid department_id FK
        timestamp without time zone created_at
    }

    "achievements" }|--|| "cycles" : "cycle_id -> id"
    "achievements" }|--|| "goals" : "goal_id -> id"
    "audit_logs" }|--|| "users" : "changed_by -> id"
    "audit_logs" }|--|| "goals" : "goal_id -> id"
    "checkins" }|--|| "users" : "manager_id -> id"
    "checkins" }|--|| "goal_sheets" : "sheet_id -> id"
    "goal_sheets" }|--|| "users" : "approved_by -> id"
    "goal_sheets" }|--|| "cycles" : "cycle_id -> id"
    "goal_sheets" }|--|| "users" : "employee_id -> id"
    "goals" }|--|| "goals" : "shared_from -> id"
    "goals" }|--|| "goal_sheets" : "sheet_id -> id"
    "users" }|--|| "departments" : "department_id -> id"
    "users" }|--|| "users" : "manager_id -> id"
```

## Relational Rules & Foreign Key Constraints

- **`achievements.cycle_id`** references **`cycles.id`** (Constraint: `achievements_cycle_id_fkey`)
- **`achievements.goal_id`** references **`goals.id`** (Constraint: `achievements_goal_id_fkey`)
- **`audit_logs.changed_by`** references **`users.id`** (Constraint: `audit_logs_changed_by_fkey`)
- **`audit_logs.goal_id`** references **`goals.id`** (Constraint: `audit_logs_goal_id_fkey`)
- **`checkins.manager_id`** references **`users.id`** (Constraint: `checkins_manager_id_fkey`)
- **`checkins.sheet_id`** references **`goal_sheets.id`** (Constraint: `checkins_sheet_id_fkey`)
- **`goal_sheets.approved_by`** references **`users.id`** (Constraint: `goal_sheets_approved_by_fkey`)
- **`goal_sheets.cycle_id`** references **`cycles.id`** (Constraint: `goal_sheets_cycle_id_fkey`)
- **`goal_sheets.employee_id`** references **`users.id`** (Constraint: `goal_sheets_employee_id_fkey`)
- **`goals.shared_from`** references **`goals.id`** (Constraint: `goals_shared_from_fkey`)
- **`goals.sheet_id`** references **`goal_sheets.id`** (Constraint: `goals_sheet_id_fkey`)
- **`users.department_id`** references **`departments.id`** (Constraint: `users_department_id_fkey`)
- **`users.manager_id`** references **`users.id`** (Constraint: `users_manager_id_fkey`)

## Table Schematics & Column Definitions

### Table: `achievements`

- **Total Exported Records**: `560`
- **JSON Data Dump**: [`achievements.json`](./supabase_dump/achievements.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `goal_id` | `uuid` | NO | NO | `*None*` |
| `cycle_id` | `uuid` | NO | NO | `*None*` |
| `quarter` | `character varying` | NO | NO | `*None*` |
| `actual` | `character varying` | YES | NO | `*None*` |
| `status` | `character varying` | NO | NO | `*None*` |
| `updated_at` | `timestamp without time zone` | NO | NO | `*None*` |

---

### Table: `alembic_version`

- **Total Exported Records**: `1`
- **JSON Data Dump**: [`alembic_version.json`](./supabase_dump/alembic_version.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `version_num` | `character varying` | NO | 🔑 YES | `*None*` |

---

### Table: `audit_logs`

- **Total Exported Records**: `7`
- **JSON Data Dump**: [`audit_logs.json`](./supabase_dump/audit_logs.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `goal_id` | `uuid` | NO | NO | `*None*` |
| `changed_by` | `uuid` | NO | NO | `*None*` |
| `field_name` | `character varying` | NO | NO | `*None*` |
| `old_value` | `character varying` | YES | NO | `*None*` |
| `new_value` | `character varying` | YES | NO | `*None*` |
| `changed_at` | `timestamp without time zone` | NO | NO | `*None*` |

---

### Table: `checkins`

- **Total Exported Records**: `201`
- **JSON Data Dump**: [`checkins.json`](./supabase_dump/checkins.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `sheet_id` | `uuid` | NO | NO | `*None*` |
| `manager_id` | `uuid` | NO | NO | `*None*` |
| `quarter` | `character varying` | NO | NO | `*None*` |
| `comment` | `text` | NO | NO | `*None*` |
| `created_at` | `timestamp without time zone` | NO | NO | `*None*` |

---

### Table: `cycles`

- **Total Exported Records**: `6`
- **JSON Data Dump**: [`cycles.json`](./supabase_dump/cycles.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `year` | `integer` | NO | NO | `*None*` |
| `phase` | `character varying` | NO | NO | `*None*` |
| `window_open` | `date` | NO | NO | `*None*` |
| `window_close` | `date` | NO | NO | `*None*` |
| `is_active` | `boolean` | NO | NO | `*None*` |

---

### Table: `departments`

- **Total Exported Records**: `7`
- **JSON Data Dump**: [`departments.json`](./supabase_dump/departments.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `name` | `character varying` | NO | NO | `*None*` |

---

### Table: `goal_sheets`

- **Total Exported Records**: `80`
- **JSON Data Dump**: [`goal_sheets.json`](./supabase_dump/goal_sheets.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `employee_id` | `uuid` | NO | NO | `*None*` |
| `cycle_id` | `uuid` | NO | NO | `*None*` |
| `status` | `character varying` | NO | NO | `*None*` |
| `submitted_at` | `timestamp without time zone` | YES | NO | `*None*` |
| `approved_at` | `timestamp without time zone` | YES | NO | `*None*` |
| `approved_by` | `uuid` | YES | NO | `*None*` |

---

### Table: `goals`

- **Total Exported Records**: `155`
- **JSON Data Dump**: [`goals.json`](./supabase_dump/goals.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `sheet_id` | `uuid` | NO | NO | `*None*` |
| `shared_from` | `uuid` | YES | NO | `*None*` |
| `thrust_area` | `character varying` | NO | NO | `*None*` |
| `title` | `character varying` | NO | NO | `*None*` |
| `description` | `text` | YES | NO | `*None*` |
| `uom_type` | `character varying` | NO | NO | `*None*` |
| `target` | `character varying` | NO | NO | `*None*` |
| `weightage` | `integer` | NO | NO | `*None*` |
| `is_locked` | `boolean` | NO | NO | `*None*` |

---

### Table: `users`

- **Total Exported Records**: `15`
- **JSON Data Dump**: [`users.json`](./supabase_dump/users.json)

| Column Name | Data Type | Nullable | Primary Key? | Default Value |
|---|---|---|---|---|
| `id` | `uuid` | NO | 🔑 YES | `*None*` |
| `email` | `character varying` | NO | NO | `*None*` |
| `full_name` | `character varying` | NO | NO | `*None*` |
| `role` | `character varying` | NO | NO | `*None*` |
| `manager_id` | `uuid` | YES | NO | `*None*` |
| `department_id` | `uuid` | YES | NO | `*None*` |
| `created_at` | `timestamp without time zone` | NO | NO | `*None*` |

---

