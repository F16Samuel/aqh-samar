# Summary: Database Re-Seed & UI Revert

The database has been completely wiped and seeded with comprehensive historical and edge-case data. The requested UI pages have also been reverted to their original UUID-based input forms.

## 1. UI Changes
- **Shared Goals (`/app/admin/shared-goals`)**: Reverted to the original component. It now requires a manual UUID for the source goal and uses a raw list of checkboxes for recipients.
- **Unlock Goal (`/app/admin/unlock`)**: Reverted to the original component. It now uses a single text input for the Goal UUID.

## 2. Seeded Accounts
All accounts share the same password: `password123`.

### Admin
- `admin@company.com` (HR System Admin)

### Managers
- `mgr1@company.com` (Engineering)
- `mgr2@company.com` (Sales)
- `mgr3@company.com` (Marketing)
- `mgr4@company.com` (Product)

### Employees (Key Scenarios)
- `emp1@company.com` (Standard approved sheet)
- `emp2@company.com` (Sheet returned by manager)
- `emp3@company.com` (Under-allocated weightage: 30%)
- `emp_new@company.com` (Empty sheet / New hire)
- `emp4@company.com` (Sheet pending manager approval)
- `emp_stuck@company.com` (**Escalation**: sheet submitted 15 days ago, ignored by mgr2)
- `emp5@company.com` & `emp6@company.com` (**Shared Goals**: received a pushed KPI from Marketing manager)
- `emp7@company.com` (**Audit Log**: Goal was forcefully unlocked by admin)

## 3. Historical Data
The database now contains 5 complete performance cycles dating back to **2022**. Employees and managers have approved goals, tracked quarterly achievements, and documented check-ins for the years 2022, 2023, 2024, and 2025. This ensures your trend graphs and historical reports are fully populated for demonstration purposes!
