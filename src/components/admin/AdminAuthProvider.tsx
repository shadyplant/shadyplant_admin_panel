"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  adminRequest,
  type AdminStaff,
  type ApiResponse,
} from "@/lib/admin-api";

type AdminAuthContextValue = {
  staff: AdminStaff | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (nextStaff: AdminStaff) => void;
  logout: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  authorizedRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<AdminStaff | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
          "/admin/auth/me",
        );

        if (!cancelled) {
          setStaff(response.data.staff);
        }
      } catch {
        if (!cancelled) {
          setStaff(null);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function setSession(nextStaff: AdminStaff) {
    setStaff(nextStaff);
  }

  async function login(email: string, password: string) {
    const response = await adminRequest<
      ApiResponse<{ staff: AdminStaff; expiresIn: string }>
    >("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setSession(response.data.staff);
  }

  async function logout() {
    try {
      await adminRequest<ApiResponse<{ success: boolean }>>("/admin/auth/logout", {
        method: "POST",
      });
    } catch {
      // Clear local session state even if the logout request fails.
    }

    setStaff(null);
  }

  async function refreshStaff() {
    try {
      const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
        "/admin/auth/me",
      );

      setStaff(response.data.staff);
    } catch {
      setStaff(null);
    }
  }

  async function authorizedRequest<T>(path: string, init: RequestInit = {}) {
    if (!staff) {
      throw new Error("Admin session is not available.");
    }

    return adminRequest<T>(path, init);
  }

  const value: AdminAuthContextValue = {
    staff,
    hydrated,
    isAuthenticated: Boolean(staff),
    login,
    setSession,
    logout,
    refreshStaff,
    authorizedRequest,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }

  return context;
}
