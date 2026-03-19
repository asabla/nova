import { create } from "zustand";
import { setActiveOrgId, getActiveOrgId } from "../lib/api";

interface AuthState {
  session: any | null;
  user: any | null;
  activeOrgId: string | null;
  initOrgError: string | null;
  setSession: (session: any | null) => void;
  setActiveOrg: (orgId: string) => void;
  initOrg: () => Promise<void>;
  logout: () => void;
}

// Singleton promise to prevent concurrent initOrg calls
let initOrgPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  activeOrgId: getActiveOrgId(),
  initOrgError: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setActiveOrg: (orgId) => {
    setActiveOrgId(orgId);
    set({ activeOrgId: orgId });
  },
  initOrg: async () => {
    // Return existing promise if initOrg is already in flight
    if (initOrgPromise) return initOrgPromise;

    initOrgPromise = (async () => {
      try {
        set({ initOrgError: null });
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
        } else {
          set({ initOrgError: "Failed to initialize organization" });
        }
      } catch {
        set({ initOrgError: "Failed to initialize organization" });
      } finally {
        initOrgPromise = null;
      }
    })();

    return initOrgPromise;
  },
  logout: () => {
    setActiveOrgId(null);
    set({ session: null, user: null, activeOrgId: null, initOrgError: null });
  },
}));
