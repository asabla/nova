import { create } from "zustand";

interface AuthState {
  session: any | null;
  user: any | null;
  activeOrgId: string | null;
  setSession: (session: any | null) => void;
  setActiveOrg: (orgId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  activeOrgId: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setActiveOrg: (orgId) => set({ activeOrgId: orgId }),
  logout: () => set({ session: null, user: null, activeOrgId: null }),
}));
