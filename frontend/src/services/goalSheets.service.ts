import { http } from "@/api/httpClient";
import type { GoalSheetOut, ReturnPayload } from "@/types/api";

export const goalSheetsService = {
  create: () => http.post<GoalSheetOut>("/goal-sheets/"),
  mine: () => http.get<GoalSheetOut[]>("/goal-sheets/mine"),
  team: () => http.get<GoalSheetOut[]>("/goal-sheets/team"),
  get: (id: string) => http.get<GoalSheetOut>(`/goal-sheets/${id}`),
  submit: (id: string) => http.post<GoalSheetOut>(`/goal-sheets/${id}/submit`),
  approve: (id: string) => http.post<GoalSheetOut>(`/goal-sheets/${id}/approve`),
  return: (id: string, payload: ReturnPayload) =>
    http.post<GoalSheetOut>(`/goal-sheets/${id}/return`, payload),
};
