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
  setSession: (nextStaff: AdminStaff, token?: string | null) => void;
  logout: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  authorizedRequest: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);
const ADMIN_SESSION_STORAGE_KEY = "shadyplant-admin-session";

type StoredAdminSession = {
  staff: AdminStaff;
  token: string | null;
};

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredAdminSession> | null;
    if (!parsed || !parsed.staff) {
      return null;
    }

    return {
      staff: parsed.staff,
      token: typeof parsed.token === "string" ? parsed.token : null,
    } as StoredAdminSession;
  } catch {
    return null;
  }
}

function persistSession(session: StoredAdminSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<AdminStaff | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedSession = readStoredSession();

      if (storedSession?.token) {
        try {
          const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
            "/admin/auth/me",
            {},
            storedSession.token,
          );

          if (!cancelled) {
            setStaff(response.data.staff);
            setAuthToken(storedSession.token);
            persistSession({
              staff: response.data.staff,
              token: storedSession.token,
            });
          }

          return;
        } catch {
          persistSession(null);
        }
      }

      try {
        const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
          "/admin/auth/me",
        );

        if (!cancelled) {
          setStaff(response.data.staff);
          setAuthToken(null);
        }
      } catch {
        if (!cancelled) {
          setStaff(null);
          setAuthToken(null);
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

  function setSession(nextStaff: AdminStaff, token: string | null = null) {
    setStaff(nextStaff);
    setAuthToken(token);
    persistSession({
      staff: nextStaff,
      token,
    });
  }

  async function login(email: string, password: string) {
    const response = await adminRequest<
      ApiResponse<{
        staff: AdminStaff;
        expiresIn: string;
        token?: string;
        accessToken?: string;
        authToken?: string;
      }>
    >("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const nextToken =
      response.data.token ||
      response.data.accessToken ||
      response.data.authToken ||
      null;

    setSession(response.data.staff, nextToken);
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
    setAuthToken(null);
    persistSession(null);
  }

  async function refreshStaff() {
    try {
      const response = await adminRequest<ApiResponse<{ staff: AdminStaff }>>(
        "/admin/auth/me",
        {},
        authToken,
      );

      setStaff(response.data.staff);
      setAuthToken(authToken);
      persistSession({
        staff: response.data.staff,
        token: authToken,
      });
    } catch {
      setStaff(null);
      setAuthToken(null);
      persistSession(null);
    }
  }

  async function authorizedRequest<T>(path: string, init: RequestInit = {}) {
    if (!staff) {
      throw new Error("Admin session is not available.");
    }

    return adminRequest<T>(path, init, authToken);
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
