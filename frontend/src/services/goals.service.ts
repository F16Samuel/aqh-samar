import { http } from "@/api/httpClient";
import type { GoalCreate, GoalOut, GoalSharedCreate, GoalUpdate } from "@/types/api";

export const goalsService = {
  create: (body: GoalCreate) => http.post<GoalOut>("/goals/", body),
  update: (id: string, body: GoalUpdate) => http.patch<GoalOut>(`/goals/${id}`, body),
  bySheet: (sheetId: string) => http.get<GoalOut[]>(`/goals/sheet/${sheetId}`),
  share: (body: GoalSharedCreate) => http.post<GoalOut[]>("/goals/shared", body),
};
