// DTOs mirror the AQH-SAMAR API documentation 1:1.

export type Role = "employee" | "manager" | "admin";

export type UoMType = "min" | "max" | "timeline" | "zero";

export type AchievementStatus = "Not Started" | "On Track" | "Completed";

export type SheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "returned"
  | "locked"
  | string; // backend is source of truth

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
  department_id: string | null;
}

export type UserCreate = Omit<UserOut, "id">;

export type UserUpdate = Partial<Pick<UserOut, "role" | "manager_id" | "department_id">>;

export interface CycleOut {
  id: string;
  year: number;
  phase: string;
  window_open: string;
  window_close: string;
  is_active: boolean;
}

export interface CycleCreate {
  year: number;
  phase: string;
  window_open: string;
  window_close: string;
  is_active: boolean;
}

export type CycleUpdate = Partial<CycleCreate>;

export interface GoalSheetOut {
  id: string;
  user_id: string;
  cycle_id: string;
  status: SheetStatus;
  submitted_at?: string | null;
  approved_at?: string | null;
  [k: string]: unknown;
}

export interface GoalOut {
  id: string;
  sheet_id: string;
  thrust_area: string;
  title: string;
  description: string | null;
  uom_type: UoMType;
  target: string;
  weightage: number;
  is_locked: boolean;
  shared_from: string | null;
}

export interface GoalCreate {
  sheet_id: string;
  thrust_area: string;
  title: string;
  description?: string | null;
  uom_type: UoMType;
  target: string;
  weightage: number;
}

export type GoalUpdate = Partial<Omit<GoalCreate, "sheet_id">>;

export interface GoalSharedCreate {
  source_goal_id: string;
  employee_ids: string[];
  weightage: number;
}

export interface AchievementOut {
  id: string;
  goal_id: string;
  quarter: string;
  actual: string | null;
  status: AchievementStatus;
  [k: string]: unknown;
}

export interface AchievementCreate {
  goal_id: string;
  quarter: string;
  actual?: string | null;
  status: AchievementStatus;
}

export type AchievementUpdate = Partial<Omit<AchievementCreate, "goal_id">>;

export interface CheckInOut {
  id: string;
  sheet_id: string;
  quarter: string;
  comment: string;
  author_id?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface CheckInCreate {
  sheet_id: string;
  quarter: string;
  comment: string;
}

export interface ReturnPayload {
  comment: string;
}

export interface ApiErrorBody {
  data: null;
  error: { code: string; message: string; details?: unknown };
}

export interface CompletionReport {
  [k: string]: unknown;
}

export interface EscalationItem {
  [k: string]: unknown;
}

export interface AuditLogOut {
  id: string;
  goal_id: string;
  changed_by: string;
  changed_by_name: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}
