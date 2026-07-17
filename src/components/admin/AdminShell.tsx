"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BadgePercent,
  CheckCircle2,
  Mail,
  House,
  LayoutGrid,
  Leaf,
  LogOut,
  Package,
  Map,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Settings2,
  Star,
  Truck,
  UserCircle2,
  Users,
  X,
  Info,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { ADMIN_SNACKBAR_EVENT, type AdminSnackbarState } from "@/components/admin/AdminSnackbar";
import {
  canViewCatalog,
  canViewCoupons,
  canViewCustomers,
  canViewMailer,
  canViewOrders,
  canViewShippingZones,
  canViewReviews,
  canViewSettings,
  canViewTeam,
  canViewTransactions,
} from "@/lib/admin-permissions";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "ggn_admin_sidebar_collapsed";
const ORDER_NOTIFICATION_STORAGE_KEY = "ggn_admin_last_seen_order_marker";
const ORDER_POLL_INTERVAL_MS = 20000;
const SNACKBAR_TONE_STYLES = {
  success: {
    panel: "border-[#cfe8d0] bg-[#eff8ef]",
    label: "text-[#2f7a42]",
    icon: "text-[#2f7a42]",
    accent: "bg-[#2f7a42]",
    action: "text-[#2f7a42] hover:bg-[#dff1e0]",
  },
  error: {
    panel: "border-[#f4cfcf] bg-[#fff2f2]",
    label: "text-[#b43c3c]",
    icon: "text-[#b43c3c]",
    accent: "bg-[#b43c3c]",
    action: "text-[#b43c3c] hover:bg-[#fde4e4]",
  },
  warning: {
    panel: "border-[#f1dcc1] bg-[#fff8ef]",
    label: "text-[#bb6c1e]",
    icon: "text-[#bb6c1e]",
    accent: "bg-[#d78b2f]",
    action: "text-[#bb6c1e] hover:bg-[#faead4]",
  },
  info: {
    panel: "border-[#d9e1ea] bg-[#f4f7fb]",
    label: "text-[#44607a]",
    icon: "text-[#44607a]",
    accent: "bg-[#44607a]",
    action: "text-[#44607a] hover:bg-[#e5edf7]",
  },
} as const;

const navItems = [
  { href: "/", label: "Dashboard", icon: House, canAccess: () => true },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    canAccess: canViewCatalog,
  },
  {
    href: "/home-categories",
    label: "Home Bar",
    icon: LayoutGrid,
    canAccess: canViewCatalog,
  },
  {
    href: "/home-slider-banners",
    label: "Home Slider",
    icon: LayoutGrid,
    canAccess: canViewCatalog,
  },
  {
    href: "/lawn-grass-page",
    label: "Lawn Grass",
    icon: Leaf,
    canAccess: canViewCatalog,
  },
  {
    href: "/coupons",
    label: "Coupons",
    icon: BadgePercent,
    canAccess: canViewCoupons,
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ReceiptText,
    canAccess: canViewTransactions,
  },
  {
    href: "/sales-report",
    label: "Sales Report",
    icon: BarChart3,
    canAccess: canViewOrders,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    canAccess: canViewOrders,
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    canAccess: canViewCustomers,
  },
  {
    href: "/mailer",
    label: "Mailer",
    icon: Mail,
    canAccess: canViewMailer,
  },
  {
    href: "/settings/payment-gateway",
    label: "Gateway",
    icon: Settings2,
    canAccess: canViewSettings,
  },
  {
    href: "/shipping-zones",
    label: "Shipping",
    icon: Map,
    canAccess: canViewShippingZones,
  },
  {
    href: "/delivery-charges",
    label: "Charges",
    icon: Truck,
    canAccess: canViewShippingZones,
  },
  {
    href: "/reviews",
    label: "Reviews",
    icon: Star,
    canAccess: canViewReviews,
  },
  { href: "/team", label: "Team", icon: ShieldCheck, canAccess: canViewTeam },
  { href: "/profile", label: "Profile", icon: UserCircle2, canAccess: () => true },
] satisfies Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  canAccess: (role: string) => boolean;
}>;

type OrderMarker = {
  id: string;
  createdAt: string;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function parseOrderTimestamp(value: string | null | undefined) {
  const timestamp = new Date(String(value || "")).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readStoredOrderMarker() {
  try {
    const rawValue = window.localStorage.getItem(ORDER_NOTIFICATION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<OrderMarker>;

    if (!parsedValue.id || !parsedValue.createdAt) {
      return null;
    }

    return {
      id: String(parsedValue.id),
      createdAt: String(parsedValue.createdAt),
    };
  } catch {
    return null;
  }
}

function writeStoredOrderMarker(marker: OrderMarker) {
  window.localStorage.setItem(
    ORDER_NOTIFICATION_STORAGE_KEY,
    JSON.stringify(marker),
  );
}

function playNewOrderSound() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.4);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.42);

  window.setTimeout(() => {
    void audioContext.close().catch(() => undefined);
  }, 700);
}

function announceNewOrder(message: string) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function getStaffInitials(name: string | null | undefined) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "A";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated, staff, logout, authorizedRequest } = useAdminAuth();
  const [snackbar, setSnackbar] = useState<AdminSnackbarState | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true";
  });
  const isOrderWatcherReadyRef = useRef(false);
  const snackbarTimerRef = useRef<number | null>(null);
  const latestOrderMarkerRef = useRef<OrderMarker | null>(null);

  const showNotification = useCallback((nextSnackbar: AdminSnackbarState) => {
    setSnackbar({
      tone: "success",
      actionLabel: "Dismiss",
      ...nextSnackbar,
    });

    if (snackbarTimerRef.current) {
      window.clearTimeout(snackbarTimerRef.current);
    }

    snackbarTimerRef.current = window.setTimeout(() => {
      setSnackbar(null);
      snackbarTimerRef.current = null;
    }, 9000);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (snackbarTimerRef.current) {
        window.clearTimeout(snackbarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSE_STORAGE_KEY,
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleSnackbarEvent = (event: Event) => {
      const customEvent = event as CustomEvent<AdminSnackbarState>;
      if (!customEvent.detail) {
        return;
      }

      showNotification(customEvent.detail);
    };

    window.addEventListener(ADMIN_SNACKBAR_EVENT, handleSnackbarEvent as EventListener);

    return () => {
      window.removeEventListener(ADMIN_SNACKBAR_EVENT, handleSnackbarEvent as EventListener);
    };
  }, [showNotification]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !staff || !canViewOrders(staff.role)) {
      isOrderWatcherReadyRef.current = false;
      latestOrderMarkerRef.current = null;
      return;
    }

    let cancelled = false;

    const syncOrders = async () => {
      try {
        const response =
          await authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
            "/admin/orders",
          );

        if (cancelled) {
          return;
        }

        const orders = [...response.data.orders].sort(
          (left, right) =>
            parseOrderTimestamp(right.createdAt) - parseOrderTimestamp(left.createdAt),
        );

        if (!orders.length) {
          return;
        }

        const latestOrder = orders[0];
        const latestMarker = {
          id: latestOrder.id,
          createdAt: latestOrder.createdAt,
        };
        const storedMarker =
          latestOrderMarkerRef.current || readStoredOrderMarker();

        if (!isOrderWatcherReadyRef.current) {
          latestOrderMarkerRef.current = latestMarker;
          writeStoredOrderMarker(latestMarker);
          isOrderWatcherReadyRef.current = true;
          return;
        }

        const storedTimestamp = parseOrderTimestamp(storedMarker?.createdAt);
        const newOrders = orders.filter((order) => {
          const orderTimestamp = parseOrderTimestamp(order.createdAt);

          return (
            orderTimestamp > storedTimestamp ||
            (orderTimestamp === storedTimestamp && order.id !== storedMarker?.id)
          );
        });

        if (newOrders.length) {
          const newestOrder = newOrders[0];
          const orderCount = newOrders.length;
          const spokenMessage =
            orderCount === 1
              ? `New order received from ${newestOrder.fullName}.`
              : `${orderCount} new orders received.`;

          playNewOrderSound();
          announceNewOrder(spokenMessage);
          showNotification({
            tone: "info",
            title: orderCount === 1 ? "New order received" : `${orderCount} new orders received`,
            body:
              orderCount === 1
                ? `${newestOrder.orderNumber} from ${newestOrder.fullName}`
                : "Open orders to review the latest incoming requests.",
            href: orderCount === 1 ? `/orders/${newestOrder.id}` : "/orders",
            actionLabel: orderCount === 1 ? "Open order" : "Open orders",
          });
        }

        latestOrderMarkerRef.current = latestMarker;
        writeStoredOrderMarker(latestMarker);
      } catch {
        return;
      }
    };

    void syncOrders();
    const intervalId = window.setInterval(() => {
      void syncOrders();
    }, ORDER_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authorizedRequest, hydrated, isAuthenticated, staff]);

  if (!hydrated || !isAuthenticated || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-canvas)] text-[var(--admin-ink)]">
        <div className="rounded-[1.5rem] border border-[var(--admin-line)] bg-white px-8 py-6 text-sm font-semibold shadow-[0_30px_80px_rgba(14,31,13,0.08)]">
          Loading admin workspace...
        </div>
      </div>
    );
  }

  const visibleNavItems = navItems.filter((item) => item.canAccess(staff.role));

  return (
    <div className="h-screen overflow-hidden bg-[#ffffff] text-[var(--admin-ink)]">
      <div
        className="grid h-full w-full lg:transition-[grid-template-columns] lg:duration-300"
        style={{
          gridTemplateColumns: isSidebarCollapsed
            ? "96px minmax(0, 1fr)"
            : "280px minmax(0, 1fr)",
        }}
      >
        <aside className="min-h-0 border-r border-[var(--admin-line)] bg-[#ffffff] lg:sticky lg:top-0 lg:h-screen">
          <div className="admin-scrollbar-thin flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)]">
            <div className="flex shrink-0 items-center gap-2 rounded-[0.9rem] px-3 py-3 text-gray-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/14">
                <LayoutGrid className="h-[18px] w-[18px]" />
              </div>
              {!isSidebarCollapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold uppercase text-gray-600">
                    ShadyPlant
                  </p>
                  <p className="truncate text-sm font-semibold text-gray-800">
                    Admin Panel
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white/10 text-gray-600 transition hover:bg-white/18 lg:inline-flex"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-[18px] w-[18px]" />
                ) : (
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>

            <nav className="admin-scrollbar-thin mt-6 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)]">
              {visibleNavItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    isSidebarCollapsed ? "justify-center" : "gap-3"
                  } ${
                      active
                        ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                    aria-label={item.label}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-[#207958] text-white"
                          : " text-gray-500"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    {!isSidebarCollapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 shrink-0">
              <div
                className={`rounded-xl bg-white px-2 py-2 shadow-[0_6px_18px_rgba(18,43,16,0.05)] ${
                  isSidebarCollapsed ? "space-y-2" : "flex items-center gap-2"
                }`}
              >
                <Link
                  href="/profile"
                  className={`flex rounded-full px-2 py-1 transition hover:bg-[var(--admin-chip)] ${
                    isSidebarCollapsed ? "justify-center" : "min-w-0 flex-1 items-center gap-3"
                  }`}
                  aria-label="Open profile"
                  title={isSidebarCollapsed ? "Profile" : undefined}
                >
                  <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "min-w-0 flex-1 gap-3"}`}>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--admin-chip)] text-sm font-black tracking-[0.08em] text-[var(--admin-line-strong)]">
                      {getStaffInitials(staff.fullName)}
                    </span>
                    {!isSidebarCollapsed ? (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-700">
                          {staff.fullName}
                        </p>
                        <p className="truncate text-xs uppercase tracking-[0.14em] text-gray-500">
                          {staff.role}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-[#efc7c1] bg-[#fff5f3] text-sm font-semibold text-[#b24336] transition hover:bg-[#ffecea] ${
                    isSidebarCollapsed ? "h-10 w-full px-0" : "px-4 py-2"
                  }`}
                  aria-label="Open log out confirmation"
                  title="Log out"
                >
                  {isSidebarCollapsed ? (
                    <LogOut className="h-[18px] w-[18px]" />
                  ) : (
                    "Log out"
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-scrollbar-thin min-h-0 min-w-0 overflow-y-auto bg-[#ffffff] px-4 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)] sm:px-5 lg:h-screen lg:px-6 lg:py-5">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>

      {snackbar ? (
        <div className="pointer-events-none fixed right-5 top-5 z-[120] w-[min(92vw,32rem)]">
          <div
            className={`admin-snackbar-enter pointer-events-auto relative overflow-hidden rounded-[1.25rem] border px-5 py-4 shadow-[0_18px_40px_rgba(16,40,17,0.14)] ${
              SNACKBAR_TONE_STYLES[snackbar.tone || "success"].panel
            }`}
          >
            <div className="flex items-start gap-4 pr-8">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 ${
                  SNACKBAR_TONE_STYLES[snackbar.tone || "success"].icon
                }`}
              >
                {snackbar.tone === "error" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : snackbar.tone === "warning" ? (
                  <Info className="h-4 w-4" />
                ) : snackbar.tone === "info" ? (
                  <Info className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    SNACKBAR_TONE_STYLES[snackbar.tone || "success"].label
                  }`}
                >
                  {snackbar.tone === "error"
                    ? "Error"
                    : snackbar.tone === "warning"
                      ? "Warning"
                      : snackbar.tone === "info"
                        ? "Info"
                        : "Success"}
                </p>
                <h2 className="mt-1 text-[15px] font-black tracking-[-0.03em] text-[var(--admin-ink)]">
                  {snackbar.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
                  {snackbar.body}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSnackbar(null)}
                className="absolute right-3 top-3 rounded-full p-1 text-[var(--admin-muted)] transition hover:bg-white/70 hover:text-[var(--admin-ink)]"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={`admin-snackbar-progress h-full w-full ${SNACKBAR_TONE_STYLES[snackbar.tone || "success"].accent}`}
              />
            </div>

            <div className="mt-4 flex justify-start">
              {snackbar.href ? (
                <Link
                  href={snackbar.href}
                  className={`inline-flex items-center justify-center rounded-full border border-transparent px-4 py-2 text-sm font-semibold transition ${
                    SNACKBAR_TONE_STYLES[snackbar.tone || "success"].action
                  }`}
                >
                  {snackbar.actionLabel || "Open"}
                </Link>
              )  : null}
            </div>
          </div>
        </div>
      ) : null}

      {isLogoutConfirmOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgba(15,24,12,0.16)] px-4">
          <div className="w-full max-w-sm rounded-[1rem] border border-[#efc7c1] bg-white p-5 shadow-[0_20px_50px_rgba(20,30,18,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b24336]">
              Confirm logout
            </p>
            <h2 className="mt-2 text-lg font-bold text-[var(--admin-ink)]">
              Are you sure to log out?
            </h2>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">
              You will need to sign in again to access the admin workspace.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="rounded-full border border-[var(--admin-line)] px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  logout();
                  router.replace("/login");
                }}
                className="rounded-full bg-[#b24336] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9b362b]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
