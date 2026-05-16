import { http } from "@/api/httpClient";
import type { AchievementCreate, AchievementOut, AchievementUpdate } from "@/types/api";

export const achievementsService = {
  create: (body: AchievementCreate) => http.post<AchievementOut>("/achievements/", body),
  update: (id: string, body: AchievementUpdate) =>
    http.patch<AchievementOut>(`/achievements/${id}`, body),
  byGoal: (goalId: string) => http.get<AchievementOut[]>(`/achievements/goal/${goalId}`),
};
