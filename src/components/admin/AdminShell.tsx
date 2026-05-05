"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  canViewCatalog,
  canViewCustomers,
  canViewOrders,
  canViewReviews,
  canViewTeam,
  canViewTransactions,
} from "@/lib/admin-permissions";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";

const navItems = [
  { href: "/", label: "Dashboard", short: "DB", canAccess: () => true },
  {
    href: "/products",
    label: "Products",
    short: "PR",
    canAccess: canViewCatalog,
  },
  {
    href: "/home-categories",
    label: "Home Bar",
    short: "HB",
    canAccess: canViewCatalog,
  },
  {
    href: "/services",
    label: "Services",
    short: "SV",
    canAccess: canViewCatalog,
  },
  {
    href: "/transactions",
    label: "Transactions",
    short: "TX",
    canAccess: canViewTransactions,
  },
  { href: "/orders", label: "Orders", short: "OR", canAccess: canViewOrders },
  {
    href: "/customers",
    label: "Customers",
    short: "CU",
    canAccess: canViewCustomers,
  },
  {
    href: "/reviews",
    label: "Reviews",
    short: "RV",
    canAccess: canViewReviews,
  },
  { href: "/team", label: "Team", short: "TM", canAccess: canViewTeam },
];
const ORDER_NOTIFICATION_STORAGE_KEY = "ggn_admin_last_seen_order_marker";
const ORDER_POLL_INTERVAL_MS = 20000;

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

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isAuthenticated, staff, logout, authorizedRequest } = useAdminAuth();
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
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
    <div className="h-screen overflow-hidden bg-[var(--admin-canvas)] text-[var(--admin-ink)]">
      <div className="mx-auto grid h-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-[var(--admin-line)] bg-[var(--admin-surface)] lg:sticky lg:top-0 lg:h-screen">
          <div className="admin-scrollbar-thin flex h-full min-h-0 flex-col overflow-y-auto px-5 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)]">
            <div className="shrink-0 rounded-[0.5rem] bg-[linear-gradient(145deg,#133c20,#205d2c)] text-center py-2  text-white shadow-[0_24px_60px_rgba(19,60,32,0.28)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Grass Green Nursery
              </p>
            </div>

            <nav className="admin-scrollbar-thin mt-6 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)]">
              {visibleNavItems.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                        : "text-[var(--admin-muted)] hover:bg-white hover:text-[var(--admin-ink)]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-black tracking-[0.16em] ${
                        active
                          ? "bg-[var(--admin-accent)] text-white"
                          : "bg-[var(--admin-chip)] text-[var(--admin-muted)]"
                      }`}
                    >
                      {item.short}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/*  */}
            <div className="mt-4 shrink-0 rounded-[1.15rem] border border-[var(--admin-line)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                Signed in
              </p>
              <p className="mt-1.5 text-base font-bold text-[var(--admin-ink)]">
                {staff.fullName}
              </p>
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">
                {staff.email}
              </p>

              <div className="mt-3 flex items-center justify-between rounded-[0.85rem] bg-[var(--admin-chip)] px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                  Role
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--admin-accent)]">
                  {staff.role}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="mt-3 w-full rounded-full border border-[var(--admin-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
              >
                Log out
              </button>
            </div>
          </div>
        </aside>

        <main className="admin-scrollbar-thin min-h-0 min-w-0 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(97,115,98,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.38)] hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(97,115,98,0.55)] sm:px-6 lg:h-screen lg:px-8 lg:py-6">
          <div className="min-h-full rounded-[2rem] border border-white/70 bg-white/88 p-4 shadow-[0_30px_80px_rgba(16,40,17,0.08)] backdrop-blur sm:p-6 lg:p-8">
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
    </div>
  );
}
