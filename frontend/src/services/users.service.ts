import { http } from "@/api/httpClient";
import type { UserOut } from "@/types/api";

export const usersService = {
  list: () => http.get<UserOut[]>("/users/"),
  get: (id: string) => http.get<UserOut>(`/users/${id}`),
  team: (id: string) => http.get<UserOut[]>(`/users/${id}/team`),
};
