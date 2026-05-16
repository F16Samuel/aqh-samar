import { http } from "@/api/httpClient";
import type { CheckInCreate, CheckInOut } from "@/types/api";

export const checkinsService = {
  create: (body: CheckInCreate) => http.post<CheckInOut>("/checkins/", body),
  bySheet: (sheetId: string) => http.get<CheckInOut[]>(`/checkins/sheet/${sheetId}`),
};
