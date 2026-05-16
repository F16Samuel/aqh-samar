import { z } from "zod";
import { GOAL_LIMITS, UOM_TYPES, ACHIEVEMENT_STATUSES } from "@/constants/rbac";

export const goalFormSchema = z.object({
  thrust_area: z.string().trim().min(1, "Required").max(120),
  title: z.string().trim().min(1, "Required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  uom_type: z.enum(UOM_TYPES),
  target: z.string().trim().min(1, "Required").max(120),
  weightage: z
    .number({ invalid_type_error: "Required" })
    .int("Must be a whole number")
    .min(GOAL_LIMITS.MIN_WEIGHTAGE, `Minimum ${GOAL_LIMITS.MIN_WEIGHTAGE}%`)
    .max(GOAL_LIMITS.MAX_WEIGHTAGE, `Maximum ${GOAL_LIMITS.MAX_WEIGHTAGE}%`),
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;

export function validateSheetForSubmission(weightages: number[]): {
  ok: boolean;
  reason?: string;
} {
  if (weightages.length === 0) return { ok: false, reason: "Add at least one goal" };
  if (weightages.length > GOAL_LIMITS.MAX_GOALS)
    return { ok: false, reason: `Maximum ${GOAL_LIMITS.MAX_GOALS} goals` };
  if (weightages.some((w) => w < GOAL_LIMITS.MIN_WEIGHTAGE))
    return { ok: false, reason: `Each goal must be ≥ ${GOAL_LIMITS.MIN_WEIGHTAGE}%` };
  const total = weightages.reduce((a, b) => a + b, 0);
  if (total !== GOAL_LIMITS.TOTAL_WEIGHTAGE)
    return { ok: false, reason: `Total weightage must equal 100% (currently ${total}%)` };
  return { ok: true };
}

export const achievementFormSchema = z.object({
  quarter: z.string().min(1, "Required"),
  actual: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.enum(ACHIEVEMENT_STATUSES),
});

export type AchievementFormValues = z.infer<typeof achievementFormSchema>;

export const checkinFormSchema = z.object({
  quarter: z.string().min(1, "Required"),
  comment: z.string().trim().min(1, "Required").max(2000),
});
export type CheckinFormValues = z.infer<typeof checkinFormSchema>;

export const cycleFormSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  phase: z.string().trim().min(1).max(40),
  window_open: z.string().min(1),
  window_close: z.string().min(1),
  is_active: z.boolean(),
});
export type CycleFormValues = z.infer<typeof cycleFormSchema>;
