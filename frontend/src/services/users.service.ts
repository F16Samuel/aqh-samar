import { http } from "@/api/httpClient";
import type { UserOut } from "@/types/api";

export const usersService = {
  list: () => http.get<UserOut[]>("/users/"),
  get: (id: string) => http.get<UserOut>(`/users/${id}`),
  team: (id: string) => http.get<UserOut[]>(`/users/${id}/team`),
  update: (id: string, body: import("@/types/api").UserUpdate) => http.patch<UserOut>(`/users/${id}`, body),
  createProfile: (body: import("@/types/api").UserCreate) => http.post<UserOut>("/users/profiles", body),
};
