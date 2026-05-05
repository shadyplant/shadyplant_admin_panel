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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Control Center"
        description=""
      />

      <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
        <AdminMetricCard
          label="Products"
          value={String(state.products.length)}
          meta={`${featuredProducts.length} featured entries ready for the storefront`}
        />
        <AdminMetricCard
          label="Services"
          value={String(state.services.length)}
          meta={`${activeServices.length} active services across the organization`}
        />
        <AdminMetricCard
          label="Orders"
          value={String(state.orders.length)}
          meta={`${state.orders.filter((order) => order.currentStatus !== "delivered").length} still in live fulfillment`}
        />
        <AdminMetricCard
          label="Customers"
          value={String(state.customers.length)}
          meta={`${state.customers.filter((customer) => customer.isVerified).length} verified customer accounts`}
        />
        <AdminMetricCard
          label="Pending Reviews"
          value={String(pendingReviews.length)}
          meta={`${state.staff.length} staff accounts can manage operations`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminPanel>
          <AdminSectionTitle
            title="Recent Orders"
            description="Quick visibility into the latest customer demand and delivery progress."
            action={
              <Link
                href="/orders"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                View all orders
              </Link>
            }
          />
          <div className="mt-5 space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex flex-col gap-3 rounded-[1.3rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4 transition hover:border-[var(--admin-line-strong)] hover:bg-white md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--admin-ink)]">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
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
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Moderation Queue"
            description="Reviews waiting for approval or rejection."
            action={
              <Link
                href="/reviews"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                Open reviews
              </Link>
            }
          />
          <div className="mt-5 space-y-3">
            {pendingReviews.slice(0, 5).map((review) => (
              <div
                key={review.id}
                className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[var(--admin-ink)]">
                    {review.title || "Untitled review"}
                  </p>
                  <AdminStatusPill status={review.status} />
                </div>
                <p className="mt-2 text-sm text-[var(--admin-muted)]">
                  {review.authorName} • {review.rating}/5
                </p>
              </div>
            ))}
            {!pendingReviews.length ? (
              <p className="rounded-[1.2rem] bg-[var(--admin-chip)] px-4 py-5 text-sm text-[var(--admin-muted)]">
                No pending reviews right now.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel>
          <AdminSectionTitle
            title="Newest Customers"
            description="Recently added customer accounts from the storefront."
            action={
              <Link
                href="/customers"
                className="text-sm font-semibold text-[var(--admin-accent)]"
              >
                Manage customers
              </Link>
            }
          />
          <div className="mt-5 space-y-3">
            {recentCustomers.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4 transition hover:bg-white"
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
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminSectionTitle
            title="Catalog Snapshots"
            description="Fast links to the most active management areas in your commerce stack."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/products",
                title: "Products",
                body: `${state.products.length} catalog products with gallery, pricing, and metadata.`,
              },
              {
                href: "/services",
                title: "Services",
                body: `${state.services.length} nursery service entries ready for local bookings.`,
              },
              {
                href: "/team",
                title: "Team",
                body: `${state.staff.length} staff accounts with separate organization auth.`,
              },
              {
                href: "/reviews",
                title: "Reviews",
                body: `${state.reviews.length} product reviews with moderation workflow.`,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[1.3rem] border border-[var(--admin-line)] bg-[linear-gradient(180deg,#ffffff,#f7faf4)] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(18,43,16,0.06)]"
              >
                <p className="text-base font-black tracking-[-0.03em] text-[var(--admin-ink)]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                  {item.body}
                </p>
              </Link>
            ))}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
