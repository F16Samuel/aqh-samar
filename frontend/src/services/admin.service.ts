import { http } from "@/api/httpClient";
import type { EscalationItem, GoalOut } from "@/types/api";

export const adminService = {
  unlockGoal: (goalId: string) => http.post<GoalOut>(`/admin/unlock/${goalId}`),
  escalations: () => http.get<EscalationItem[]>("/admin/escalations"),
};
