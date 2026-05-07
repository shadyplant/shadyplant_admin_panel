"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminEmptyCard,
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminMetricCard,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatCompactDate,
  resolveDeliveryCharge,
  resolveOrderTotal,
} from "@/lib/admin-utils";

type DateRangeFilter = "all" | "last_7_days" | "last_30_days" | "custom";

function normalizeOrderStatus(status: string | null | undefined) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalizedStatus === "placed" ||
    normalizedStatus === "pending" ||
    normalizedStatus === "confirmed" ||
    normalizedStatus === "processing"
  ) {
    return "placed";
  }

  if (normalizedStatus === "shipped") {
    return "shipped";
  }

  if (
    normalizedStatus === "out_for_delivery" ||
    normalizedStatus === "out for delivery"
  ) {
    return "out_for_delivery";
  }

  if (normalizedStatus === "delivered") {
    return "delivered";
  }

  return "other";
}

function getOrderTimestamp(order: AdminOrder) {
  const timestamp = new Date(order.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isOrderWithinDateRange(
  order: AdminOrder,
  dateRangeFilter: DateRangeFilter,
  fromDate: string,
  toDate: string,
) {
  if (dateRangeFilter === "all") {
    return true;
  }

  const orderTimestamp = getOrderTimestamp(order);

  if (!orderTimestamp) {
    return false;
  }

  const now = new Date();

  if (dateRangeFilter === "last_7_days") {
    const startTimestamp = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return orderTimestamp >= startTimestamp;
  }

  if (dateRangeFilter === "last_30_days") {
    const startTimestamp = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return orderTimestamp >= startTimestamp;
  }

  const startTimestamp = fromDate
    ? new Date(`${fromDate}T00:00:00`).getTime()
    : Number.NEGATIVE_INFINITY;
  const endTimestamp = toDate
    ? new Date(`${toDate}T23:59:59.999`).getTime()
    : Number.POSITIVE_INFINITY;

  return orderTimestamp >= startTimestamp && orderTimestamp <= endTimestamp;
}

export default function OrdersPage() {
  const { authorizedRequest } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] =
    useState<DateRangeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
          "/admin/orders",
        );
      setOrders(response.data.orders);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load orders.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncOrders() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
            "/admin/orders",
          );

        if (!cancelled) {
          setOrders(response.data.orders);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load orders.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncOrders();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const statusOptions = [
    ...new Set(
      orders
        .map((order) =>
          String(order.currentStatus || order.paymentStatus || "").trim(),
        )
        .filter(Boolean),
    ),
  ];

  const dateFilteredOrders = [...orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .filter((order) =>
      isOrderWithinDateRange(order, dateRangeFilter, fromDate, toDate),
    );

  const statusCounts = dateFilteredOrders.reduce(
    (summary, order) => {
      const normalizedStatus = normalizeOrderStatus(
        order.currentStatus || order.paymentStatus,
      );

      if (normalizedStatus === "placed") {
        summary.placed += 1;
      } else if (normalizedStatus === "shipped") {
        summary.shipped += 1;
      } else if (normalizedStatus === "out_for_delivery") {
        summary.outForDelivery += 1;
      } else if (normalizedStatus === "delivered") {
        summary.delivered += 1;
      }

      return summary;
    },
    {
      placed: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
    },
  );

  const filteredOrders = dateFilteredOrders
    .filter((order) => {
      const matchesQuery = [
        order.orderNumber,
        order.trackingCode,
        order.fullName,
        order.phoneNumber,
        order.email,
        order.currentStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const orderStatus = String(
        order.currentStatus || order.paymentStatus || "",
      ).trim();
      const matchesStatus =
        statusFilter === "all" || orderStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading orders..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadOrders} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Operations" title="Orders" description="" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Placed"
          value={String(statusCounts.placed)}
          meta="Orders created and waiting for next fulfillment step."
        />
        <AdminMetricCard
          label="Shipped"
          value={String(statusCounts.shipped)}
          meta="Orders that have moved out from your dispatch workflow."
        />
        <AdminMetricCard
          label="Out For Delivery"
          value={String(statusCounts.outForDelivery)}
          meta="Orders currently assigned for final customer delivery."
        />
        <AdminMetricCard
          label="Delivered"
          value={String(statusCounts.delivered)}
          meta="Orders completed inside the selected date window."
        />
      </div>

      <AdminPanel>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <AdminTextInput
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by order number, tracking code, customer, phone, or status"
                className="max-w-xl"
              />
              <AdminSelect
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="md:w-[220px]"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <p className="text-sm font-semibold text-[var(--admin-muted)]">
              {filteredOrders.length} matching orders
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <AdminTextInput
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setCurrentPage(1);
              }}
              disabled={dateRangeFilter !== "custom"}
              className="md:w-[180px]"
            />
            <AdminTextInput
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setCurrentPage(1);
              }}
              disabled={dateRangeFilter !== "custom"}
              className="md:w-[180px]"
            />
            <AdminSelect
              value={dateRangeFilter}
              onChange={(event) => {
                const nextValue = event.target.value as DateRangeFilter;
                setDateRangeFilter(nextValue);
                setCurrentPage(1);

                if (nextValue !== "custom") {
                  setFromDate("");
                  setToDate("");
                }
              }}
              className="md:w-[220px]"
            >
              <option value="all">All dates</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="custom">Custom date range</option>
            </AdminSelect>
          </div>
        </div>
      </AdminPanel>

      {!filteredOrders.length ? (
        <AdminEmptyCard
          title="No orders found"
          description="Try another search query. Orders will appear here as soon as customers place them."
        />
      ) : (
        <div className="space-y-4">
          {paginatedOrders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-[1.6rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_18px_40px_rgba(18,43,16,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(18,43,16,0.07)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                    {order.orderNumber} | {order.trackingCode || "No tracking"}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                    {order.fullName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                    {order.phoneNumber || "No phone"} |{" "}
                    {order.email || "No email"} |{" "}
                    {formatCompactDate(order.deliveryDate || order.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-[var(--admin-accent)]">
                      {formatAdminCurrency(resolveOrderTotal(order.pricing))}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      Delivery{" "}
                      {formatAdminCurrency(
                        resolveDeliveryCharge(order.pricing),
                      )}
                    </p>
                  </div>
                  <AdminStatusPill
                    status={order.currentStatus || order.paymentStatus}
                  />
                </div>
              </div>
            </Link>
          ))}
          <AdminPagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            pageSize={pageSize}
            label="orders"
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
