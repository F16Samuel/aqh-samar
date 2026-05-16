import type { AchievementOut, GoalOut } from "@/types/api";

// Returns 0..1 progress score per UoM. Pure tracking, not a rating.
export function computeGoalProgress(goal: GoalOut, achievement?: AchievementOut | null): number {
  if (!achievement) return 0;
  if (achievement.status === "Completed") return 1;
  const target = parseFloat(goal.target);
  const actual = achievement.actual ? parseFloat(achievement.actual) : NaN;
  switch (goal.uom_type) {
    case "min":
      if (isNaN(target) || target === 0 || isNaN(actual)) return 0;
      return clamp01(actual / target);
    case "max":
      if (isNaN(target) || isNaN(actual) || actual === 0) return 0;
      return clamp01(target / actual);
    case "zero":
      return actual === 0 ? 1 : 0;
    case "timeline":
      return achievement.status === "On Track" ? 0.5 : 0;
    default:
      return 0;
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function weightedCompletion(goals: GoalOut[], achievements: AchievementOut[]): number {
  if (!goals.length) return 0;
  const byGoal = new Map<string, AchievementOut[]>();
  for (const a of achievements) {
    const arr = byGoal.get(a.goal_id) ?? [];
    arr.push(a);
    byGoal.set(a.goal_id, arr);
  }
  let totalW = 0;
  let score = 0;
  for (const g of goals) {
    totalW += g.weightage;
    const latest = (byGoal.get(g.id) ?? []).slice().sort((a, b) =>
      (b.quarter || "").localeCompare(a.quarter || ""),
    )[0];
    score += g.weightage * computeGoalProgress(g, latest);
  }
  return totalW ? score / totalW : 0;
}
