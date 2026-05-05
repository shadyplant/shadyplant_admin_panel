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

const ADMIN_TOKEN_KEY = "ggn_admin_access_token";
const ADMIN_STAFF_KEY = "ggn_admin_staff";

type AdminAuthContextValue = {
  token: string | null;
  staff: AdminStaff | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (accessToken: string, nextStaff: AdminStaff) => void;
  logout: () => void;
  refreshStaff: () => Promise<void>;
  authorizedRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readStoredStaff() {
  try {
    const value = window.localStorage.getItem(ADMIN_STAFF_KEY);
    return value ? (JSON.parse(value) as AdminStaff) : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<AdminStaff | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
      const storedStaff = readStoredStaff();

      setToken(storedToken);
      setStaff(storedStaff);
      setHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function setSession(accessToken: string, nextStaff: AdminStaff) {
    setToken(accessToken);
    setStaff(nextStaff);
    window.localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
    window.localStorage.setItem(ADMIN_STAFF_KEY, JSON.stringify(nextStaff));
  }

  async function login(email: string, password: string) {
    const response = await adminRequest<
      ApiResponse<{ accessToken: string; staff: AdminStaff; expiresIn: string }>
    >("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setSession(response.data.accessToken, response.data.staff);
  }

  function logout() {
    setToken(null);
    setStaff(null);
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_STAFF_KEY);
  }

  async function refreshStaff() {
    if (!token) {
      return;
    }

    try {
      const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
        "/admin/auth/me",
        {},
        token,
      );

      setStaff(response.data.staff);
      window.localStorage.setItem(ADMIN_STAFF_KEY, JSON.stringify(response.data.staff));
    } catch {
      logout();
    }
  }

  async function authorizedRequest<T>(path: string, init: RequestInit = {}) {
    if (!token) {
      throw new Error("Admin session is not available.");
    }

    return adminRequest<T>(path, init, token);
  }

  const value: AdminAuthContextValue = {
    token,
    staff,
    hydrated,
    isAuthenticated: Boolean(token && staff),
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
