import { http } from "@/api/httpClient";
import type { UserOut } from "@/types/api";

export const authService = {
  me: () => http.get<UserOut>("/auth/me"),
  login: () => http.post<UserOut>("/auth/login"),
};
