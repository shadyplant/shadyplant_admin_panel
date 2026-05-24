"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminMetricCard,
  AdminPanel,
  AdminSectionTitle,
  AdminStatusPill,
} from "@/components/admin/AdminUi";
import type {
  AdminCustomer,
  AdminOrder,
  AdminProduct,
  AdminReview,
  AdminService,
  AdminStaff,
  ApiResponse,
} from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatCompactDate,
  resolveOrderTotal,
} from "@/lib/admin-utils";

type DashboardState = {
  products: AdminProduct[];
  services: AdminService[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  reviews: AdminReview[];
  staff: AdminStaff[];
};

export default function AdminDashboardPage() {
  const { authorizedRequest } = useAdminAuth();
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [
        productsResponse,
        servicesResponse,
        ordersResponse,
        customersResponse,
        reviewsResponse,
        staffResponse,
      ] = await Promise.all([
        authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>(
          "/admin/products",
        ),
        authorizedRequest<ApiResponse<{ services: AdminService[] }>>(
          "/admin/services",
        ),
        authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
          "/admin/orders",
        ),
        authorizedRequest<ApiResponse<{ customers: AdminCustomer[] }>>(
          "/admin/customers",
        ),
        authorizedRequest<ApiResponse<{ reviews: AdminReview[] }>>(
          "/admin/reviews",
        ),
        authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>("/admin/staff"),
      ]);

      setState({
        products: productsResponse.data.products,
        services: servicesResponse.data.services,
        orders: ordersResponse.data.orders,
        customers: customersResponse.data.customers,
        reviews: reviewsResponse.data.reviews,
        staff: staffResponse.data.staff,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [
          productsResponse,
          servicesResponse,
          ordersResponse,
          customersResponse,
          reviewsResponse,
          staffResponse,
        ] = await Promise.all([
          authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>(
            "/admin/products",
          ),
          authorizedRequest<ApiResponse<{ services: AdminService[] }>>(
            "/admin/services",
          ),
          authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
            "/admin/orders",
          ),
          authorizedRequest<ApiResponse<{ customers: AdminCustomer[] }>>(
            "/admin/customers",
          ),
          authorizedRequest<ApiResponse<{ reviews: AdminReview[] }>>(
            "/admin/reviews",
          ),
          authorizedRequest<ApiResponse<{ staff: AdminStaff[] }>>(
            "/admin/staff",
          ),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          products: productsResponse.data.products,
          services: servicesResponse.data.services,
          orders: ordersResponse.data.orders,
          customers: customersResponse.data.customers,
          reviews: reviewsResponse.data.reviews,
          staff: staffResponse.data.staff,
        });
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load dashboard data.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncDashboard();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  if (loading) {
    return <AdminLoadingCard label="Loading dashboard overview..." />;
  }

  if (error || !state) {
    return (
      <AdminErrorCard
        message={error || "Dashboard data is unavailable right now."}
        onRetry={loadDashboard}
      />
    );
  }

  const pendingReviews = state.reviews.filter(
    (review) => review.status === "pending",
  );
  const activeServices = state.services.filter((service) => service.isActive);
  const featuredProducts = state.products.filter(
    (product) => product.isFeaturedLatest,
  );
  const liveOrders = state.orders.filter(
    (order) => order.currentStatus !== "delivered",
  );
  const verifiedCustomers = state.customers.filter(
    (customer) => customer.isVerified,
  );
  const recentOrders = [...state.orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 5);
  const recentCustomers = [...state.customers]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 4);
  const shortcuts = [
    { href: "/products", title: "Products", count: state.products.length },
    { href: "/team", title: "Team", count: state.staff.length },
    { href: "/reviews", title: "Reviews", count: state.reviews.length },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Overview of catalog, orders, customers, and reviews."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard
          label="Products"
          value={String(state.products.length)}
          meta={`${featuredProducts.length} featured`}
        />
        <AdminMetricCard
          label="Services"
          value={String(state.services.length)}
          meta={`${activeServices.length} active`}
        />
        <AdminMetricCard
          label="Orders"
          value={String(state.orders.length)}
          meta={`${liveOrders.length} in progress`}
        />
        <AdminMetricCard
          label="Customers"
          value={String(state.customers.length)}
          meta={`${verifiedCustomers.length} verified`}
        />
        <AdminMetricCard
          label="Reviews"
          value={String(pendingReviews.length)}
          meta={`${state.reviews.length} total`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminPanel>
          <AdminSectionTitle
            title="Recent Orders"
            action={
              <Link
                href="/orders"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                View all
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-2 rounded-[0.85rem] px-3 py-3 transition hover:bg-[#f8faf6] md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--admin-ink)]">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--admin-muted)]">
                      {order.fullName} • {order.phoneNumber || "No phone"} •{" "}
                      {formatCompactDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">
                      {formatAdminCurrency(resolveOrderTotal(order.pricing))}
                    </span>
                    <AdminStatusPill
                      status={order.currentStatus || order.paymentStatus}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[var(--admin-muted)]">
                No recent orders.
              </p>
            )}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Moderation Queue"
            action={
              <Link
                href="/reviews"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                Open
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {pendingReviews.slice(0, 5).map((review) => (
              <div
                key={review.id}
                className="rounded-[0.85rem] px-3 py-3 transition hover:bg-[#f8faf6]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--admin-ink)]">
                    Customer review
                  </p>
                  <AdminStatusPill status={review.status} />
                </div>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {review.authorName} • {review.rating}/5
                </p>
              </div>
            ))}
            {!pendingReviews.length ? (
              <p className="px-3 py-4 text-sm text-[var(--admin-muted)]">
                No pending reviews.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel>
          <AdminSectionTitle
            title="Newest Customers"
            action={
              <Link
                href="/customers"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                View all
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {recentCustomers.length ? (
              recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="flex items-center justify-between gap-4 rounded-[0.85rem] px-3 py-3 transition hover:bg-[#f8faf6]"
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--admin-ink)]">
                      {customer.fullName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-muted)]">
                      {customer.email || customer.phoneNumber}
                    </p>
                  </div>
                  <AdminStatusPill
                    status={customer.isVerified ? "verified" : "unverified"}
                  />
                </Link>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[var(--admin-muted)]">
                No recent customers.
              </p>
            )}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle title="Shortcuts" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {shortcuts.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[0.85rem] px-4 py-3 transition hover:bg-[#f8faf6]"
              >
                <p className="text-sm font-black text-[var(--admin-ink)]">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {item.count}
                </p>
              </Link>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
