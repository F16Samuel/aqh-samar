import { http } from "@/api/httpClient";
import type { EscalationItem, GoalOut } from "@/types/api";

export const adminService = {
  unlockGoal: (goalId: string) => http.post<GoalOut>(`/admin/unlock/${goalId}`),
  escalations: () => http.get<EscalationItem[]>("/admin/escalations"),
  resolveEscalation: (id: string) => http.post(`/admin/escalations/${id}/resolve`),
  auditLogs: () => http.get<import("@/types/api").AuditLogOut[]>("/admin/audit-logs"),
};
