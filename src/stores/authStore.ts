import { create } from "zustand";

export type AuthUser = { uid: string; email: string | null; name: string | null; picture?: string | null };
type AuthState = {
  user: AuthUser | null;
  initialized: boolean;
  busy: boolean;
  error: string;
  setUser: (user: AuthUser | null) => void;
  setInitialized: (value: boolean) => void;
  setBusy: (value: boolean) => void;
  setError: (value: string) => void;
};

// Session state is in-memory only. The HttpOnly cookie remains the authority.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  busy: false,
  error: "",
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
}));
