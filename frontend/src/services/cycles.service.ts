import { http } from "@/api/httpClient";
import type { CycleCreate, CycleOut, CycleUpdate } from "@/types/api";

export const cyclesService = {
  active: () => http.get<CycleOut>("/cycles/active"),
  list: () => http.get<CycleOut[]>("/cycles/"),
  create: (body: CycleCreate) => http.post<CycleOut>("/cycles/", body),
  update: (id: string, body: CycleUpdate) => http.patch<CycleOut>(`/cycles/${id}`, body),
};
