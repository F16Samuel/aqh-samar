import { request } from "@/api/httpClient";
import type { CompletionReport } from "@/types/api";

export const reportsService = {
  completion: (params: { cycle_id?: string; quarter?: string } = {}) =>
    request<CompletionReport>("/reports/completion", { query: params }),
  achievementDownload: (params: {
    format: "csv" | "xlsx";
    cycle_id?: string;
    department_id?: string;
    target_role?: string;
  }) => request<Response>("/reports/achievement", { query: params, raw: true }),
  teamAnalytics: (params: { cycle_id?: string } = {}) =>
    request<any>("/reports/team-analytics", { query: params }),
  managerAnalytics: (params: { cycle_id?: string } = {}) =>
    request<any>("/reports/manager-analytics", { query: params }),
};
