import type { Role } from "@/types/api";

export const ROLE_LABEL: Record<Role, string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin",
};

export const ACHIEVEMENT_STATUSES = ["Not Started", "On Track", "Completed"] as const;
export const UOM_TYPES = ["min", "max", "timeline", "zero"] as const;
export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export const GOAL_LIMITS = {
  MAX_GOALS: 8,
  MIN_WEIGHTAGE: 10,
  MAX_WEIGHTAGE: 100,
  TOTAL_WEIGHTAGE: 100,
} as const;
