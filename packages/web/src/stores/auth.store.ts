import { create } from "zustand";
import { setActiveOrgId, getActiveOrgId } from "../lib/api";

interface AuthState {
  session: any | null;
  user: any | null;
  activeOrgId: string | null;
  setSession: (session: any | null) => void;
  setActiveOrg: (orgId: string) => void;
  initOrg: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  activeOrgId: getActiveOrgId(),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setActiveOrg: (orgId) => {
    setActiveOrgId(orgId);
    set({ activeOrgId: orgId });
  },
  initOrg: async () => {
    try {
      const res = await fetch("/api/auth/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.orgId) {
          setActiveOrgId(data.orgId);
          set({ activeOrgId: data.orgId });
        }
      }
    } catch {
      // Silent fail - org init will retry on next page load
    }
  },
  logout: () => {
    setActiveOrgId(null);
    set({ session: null, user: null, activeOrgId: null });
  },
}));
