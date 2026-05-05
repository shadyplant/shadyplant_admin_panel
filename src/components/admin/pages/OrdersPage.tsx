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
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatCompactDate,
  resolveOrderTotal,
} from "@/lib/admin-utils";

export default function OrdersPage() {
  const { authorizedRequest } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
        "/admin/orders",
      );
      setOrders(response.data.orders);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load orders.",
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
        .map((order) => String(order.currentStatus || order.paymentStatus || "").trim())
        .filter(Boolean),
    ),
  ];
  const filteredOrders = [...orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
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
      const orderStatus = String(order.currentStatus || order.paymentStatus || "").trim();
      const matchesStatus = statusFilter === "all" || orderStatus === statusFilter;

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
      <AdminPageHeader
        eyebrow="Operations"
        title="Orders"
        description="Review and manage incoming customer orders, delivery timelines, payment states, order items, and operational JSON payloads."
      />

      <AdminPanel>
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
            {orders.length} order records
          </p>
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
                    {order.phoneNumber || "No phone"} | {order.email || "No email"} |{" "}
                    {formatCompactDate(order.deliveryDate || order.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-black text-[var(--admin-accent)]">
                    {formatAdminCurrency(resolveOrderTotal(order.pricing))}
                  </span>
                  <AdminStatusPill status={order.currentStatus || order.paymentStatus} />
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
