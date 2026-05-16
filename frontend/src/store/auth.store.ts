import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { UserOut } from "@/types/api";

interface AuthState {
  session: Session | null;
  profile: UserOut | null;
  bootstrapped: boolean;
  setSession: (s: Session | null) => void;
  setProfile: (p: UserOut | null) => void;
  setBootstrapped: (v: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  bootstrapped: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  reset: () => set({ session: null, profile: null }),
}));
