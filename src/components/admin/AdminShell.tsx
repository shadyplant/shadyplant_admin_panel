"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BadgePercent,
  House,
  LayoutGrid,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Settings2,
  Star,
  UserCircle2,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  canViewCatalog,
  canViewCoupons,
  canViewCustomers,
  canViewOrders,
  canViewReviews,
  canViewSettings,
  canViewTeam,
  canViewTransactions,
} from "@/lib/admin-permissions";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "ggn_admin_sidebar_collapsed";
const ORDER_NOTIFICATION_STORAGE_KEY = "ggn_admin_last_seen_order_marker";
const ORDER_POLL_INTERVAL_MS = 20000;

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
    href: "/settings/payment-gateway",
    label: "Gateway",
    icon: Settings2,
    canAccess: canViewSettings,
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

type SnackbarState = {
  title: string;
  body: string;
  href: string;
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
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
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
    if (!hydrated || !isAuthenticated || !staff || !canViewOrders(staff.role)) {
      isOrderWatcherReadyRef.current = false;
      latestOrderMarkerRef.current = null;
      return;
    }

    let cancelled = false;

    const showNotification = (nextSnackbar: SnackbarState) => {
      setSnackbar(nextSnackbar);

      if (snackbarTimerRef.current) {
        window.clearTimeout(snackbarTimerRef.current);
      }

      snackbarTimerRef.current = window.setTimeout(() => {
        setSnackbar(null);
      }, 9000);
    };

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
            title: orderCount === 1 ? "New order received" : `${orderCount} new orders received`,
            body:
              orderCount === 1
                ? `${newestOrder.orderNumber} from ${newestOrder.fullName}`
                : "Open orders to review the latest incoming requests.",
            href: orderCount === 1 ? `/orders/${newestOrder.id}` : "/orders",
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
    <div className="h-screen overflow-hidden bg-[#eef1eb] text-[var(--admin-ink)]">
      <div
        className="mx-auto grid h-full max-w-[1600px] lg:transition-[grid-template-columns] lg:duration-300"
        style={{
          gridTemplateColumns: isSidebarCollapsed
            ? "96px minmax(0, 1fr)"
            : "280px minmax(0, 1fr)",
        }}
      >
        <aside className="min-h-0 border-r border-[var(--admin-line)] bg-[var(--admin-surface)] lg:sticky lg:top-0 lg:h-screen">
          <div className="admin-scrollbar-thin flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)]">
            <div className="flex shrink-0 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,#133c20,#205d2c)] px-3 py-3 text-white shadow-[0_24px_60px_rgba(19,60,32,0.28)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/14">
                <LayoutGrid className="h-[18px] w-[18px]" />
              </div>
              {!isSidebarCollapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    Grass Green Nursery
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    Admin Panel
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/18 lg:inline-flex"
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
                    className={`flex items-center rounded-[1.2rem] px-3 py-3 text-sm font-semibold transition ${
                      isSidebarCollapsed ? "justify-center" : "gap-3"
                    } ${
                      active
                        ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                        : "text-[var(--admin-muted)] hover:bg-white hover:text-[var(--admin-ink)]"
                    }`}
                    aria-label={item.label}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-[var(--admin-accent)] text-white"
                          : "bg-[var(--admin-chip)] text-[var(--admin-muted)]"
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
                className={`rounded-[1.4rem] border border-[var(--admin-line)] bg-white px-2 py-2 shadow-[0_6px_18px_rgba(18,43,16,0.05)] ${
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
                        <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">
                          {staff.fullName}
                        </p>
                        <p className="truncate text-xs uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                          {staff.role}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(true)}
                  className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#efc7c1] bg-[#fff5f3] text-sm font-semibold text-[#b24336] transition hover:bg-[#ffecea] ${
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

        <main className="admin-scrollbar-thin min-h-0 min-w-0 overflow-y-auto bg-[#eef1eb] px-4 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)] sm:px-5 lg:h-screen lg:px-6 lg:py-5">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>

      {snackbar ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[120] max-w-sm">
          <div className="pointer-events-auto rounded-[1.35rem] border border-[#d5e1cb] bg-white px-4 py-4 shadow-[0_24px_60px_rgba(16,40,17,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-accent)]">
                  Live notification
                </p>
                <h2 className="mt-1 text-base font-black tracking-[-0.03em] text-[var(--admin-ink)]">
                  {snackbar.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
                  {snackbar.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSnackbar(null)}
                className="rounded-full border border-[var(--admin-line)] px-2.5 py-1 text-xs font-bold text-[var(--admin-muted)] transition hover:bg-[var(--admin-chip)]"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <Link
                href={snackbar.href}
                className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Open order
              </Link>
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
