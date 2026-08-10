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
import { inputClassName, textareaClassName } from "@/components/admin/Forms";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import { normalizeAdminOrder, type AdminOrder, type ApiResponse } from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatCompactDate,
  resolveDeliveryCharge,
  resolveOrderTotal,
} from "@/lib/admin-utils";

type DateRangeFilter =
  | "all"
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "custom";
type OrderActionStatus =
  | "placed"
  | "confirmed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";
type OrderActionModalState = {
  order: AdminOrder;
  nextStatus: Extract<OrderActionStatus, "cancelled" | "refunded">;
};

const orderStatusOptions = [
  { value: "placed", label: "Order placed" },
  { value: "confirmed", label: "Order confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
] as const;

const cancellationReasonOptions = [
  { value: "poor_plant_health", label: "Poor Plant Health" },
  {
    value: "extreme_weather_conditions",
    label: "Extreme Weather Conditions",
  },
  { value: "out_of_stock", label: "Out of Stock" },
  {
    value: "transit_safety_limit_unserviceable_location",
    label: "Transit Safety Limit/Unserviceable Location",
  },
  { value: "payment_or_fraud_issue", label: "Payment or Fraud Issue" },
  { value: "pricing_error", label: "Pricing Error" },
] as const;

function normalizeOrderStatus(status: string | null | undefined) {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalizedStatus === "placed" ||
    normalizedStatus === "pending" ||
    normalizedStatus === "processing"
  ) {
    return "placed";
  }

  if (normalizedStatus === "confirmed") {
    return "confirmed";
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

  if (normalizedStatus === "cancelled") {
    return "cancelled";
  }

  if (normalizedStatus === "refunded") {
    return "refunded";
  }

  return "other";
}

function formatOrderStatusLabel(status: string | null | undefined) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return (
    orderStatusOptions.find((option) => option.value === normalizedStatus)?.label ||
    normalizedStatus.replaceAll("_", " ") ||
    "Unknown"
  );
}

function getOrderTimestamp(order: AdminOrder) {
  const timestamp = new Date(order.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function logOrdersResponse(label: string, data: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  const responseData = data as {
    orders?: Array<Record<string, unknown>>;
    pagination?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  const firstOrder = Array.isArray(responseData?.orders)
    ? responseData.orders[0] || null
    : null;

  console.groupCollapsed(`[OrdersPage] ${label}`);
  console.log("response data:", responseData);
  console.log("response keys:", Object.keys(responseData || {}));
  console.log("orders is array:", Array.isArray(responseData?.orders));
  console.log("orders count:", responseData?.orders?.length || 0);
  console.log("first order raw:", firstOrder);
  console.log(
    "first order keys:",
    firstOrder ? Object.keys(firstOrder) : [],
  );
  console.log("pagination:", responseData?.pagination || null);
  console.groupEnd();
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

  if (dateRangeFilter === "today" || dateRangeFilter === "yesterday") {
    const targetDate = new Date(now);

    if (dateRangeFilter === "yesterday") {
      targetDate.setDate(targetDate.getDate() - 1);
    }

    const startTimestamp = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();
    const endTimestamp = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();

    return orderTimestamp >= startTimestamp && orderTimestamp <= endTimestamp;
  }

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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [actionModal, setActionModal] = useState<OrderActionModalState | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [cancelNoteDraft, setCancelNoteDraft] = useState("");
  const [refundReasonDraft, setRefundReasonDraft] = useState("");

  function syncOrderState(updatedOrder: AdminOrder) {
    setOrders((currentOrders) =>
      currentOrders.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry)),
    );
    setStatusDrafts((currentDrafts) => ({
      ...currentDrafts,
      [updatedOrder.id]:
        String(updatedOrder.currentStatus || "placed").trim() || "placed",
    }));
  }

  function openActionModal(
    order: AdminOrder,
    nextStatus: Extract<OrderActionStatus, "cancelled" | "refunded">,
  ) {
    setActionModal({
      order,
      nextStatus,
    });
    setCancelReasonDraft(order.cancellationReason || "");
    setCancelNoteDraft(order.cancellationNote || "");
    setRefundReasonDraft(order.refundReason || "");
    setActionFeedback(null);
  }

  function closeActionModal() {
    setActionModal(null);
    setCancelReasonDraft("");
    setCancelNoteDraft("");
    setRefundReasonDraft("");
  }

  function exportOrdersAsExcel() {
    const headers = [
      "Order Number",
      "Tracking Code",
      "Customer",
      "Phone",
      "Email",
      "Delivery Date",
      "Current Status",
      "Payment Status",
      "Cancellation Reason",
      "Refund Reason",
      "Total",
      "Created At",
    ];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.trackingCode,
      order.fullName,
      order.phoneNumber,
      order.email,
      formatCompactDate(order.deliveryDate || order.createdAt),
      order.currentStatus || "",
      order.paymentStatus || "",
      order.cancellationReason || "",
      order.refundReason || "",
      String(resolveOrderTotal(order.pricing)),
      order.createdAt,
    ]);
    const tableHtml = `
      <table>
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell) => `<td>${String(cell ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    const blob = new Blob([tableHtml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportOrdersAsPdf() {
    const reportWindow = window.open("", "_blank", "width=1200,height=900");

    if (!reportWindow) {
      window.alert("Please allow popups to export the PDF report.");
      return;
    }

    const rows = filteredOrders
      .map(
        (order) => `
          <tr>
            <td>${order.orderNumber}</td>
            <td>${order.fullName}</td>
            <td>${order.phoneNumber || ""}</td>
            <td>${String(order.currentStatus || "").replaceAll("_", " ")}</td>
            <td>${String(order.paymentStatus || "").replaceAll("_", " ")}</td>
            <td>${formatCompactDate(order.deliveryDate || order.createdAt)}</td>
            <td>${formatAdminCurrency(resolveOrderTotal(order.pricing))}</td>
          </tr>
        `,
      )
      .join("");

    reportWindow.document.write(`
      <html>
        <head>
          <title>Orders Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { margin-bottom: 8px; }
            p { color: #6b7280; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Orders Report</h1>
          <p>Generated on ${new Date().toLocaleString("en-IN")}</p>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Delivery</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  async function loadOrders() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ orders: AdminOrder[] }>>(
          "/admin/orders",
        );
      logOrdersResponse("loadOrders response", response.data);
      setOrders(
        response.data.orders.map((order, index) =>
          normalizeAdminOrder(order as Record<string, unknown>, index),
        ),
      );
      setStatusDrafts(
        Object.fromEntries(
          response.data.orders.map((order, index) => {
            const normalizedOrder = normalizeAdminOrder(
              order as Record<string, unknown>,
              index,
            );

            return [
              normalizedOrder.id,
              String(normalizedOrder.currentStatus || "placed").trim() ||
                "placed",
            ];
          }),
        ),
      );
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

  async function handleQuickStatusUpdate(order: AdminOrder) {
    const nextStatus =
      String(statusDrafts[order.id] || order.currentStatus || "placed").trim() ||
      "placed";

    if (nextStatus === String(order.currentStatus || "").trim()) {
      return;
    }

    if (nextStatus === "cancelled" || nextStatus === "refunded") {
      openActionModal(order, nextStatus);
      return;
    }

    setUpdatingId(order.id);
    setActionFeedback(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
          `/admin/orders/${order.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              currentStatus: nextStatus,
            }),
          },
        );

      const updatedOrder = normalizeAdminOrder(
        response.data.order as Record<string, unknown>,
      );

      syncOrderState(updatedOrder);
      setActionFeedback({
        type: "success",
        text: `Order ${updatedOrder.orderNumber} updated to ${formatOrderStatusLabel(updatedOrder.currentStatus || nextStatus)}.`,
      });
    } catch (nextError) {
      setActionFeedback({
        type: "error",
        text:
          nextError instanceof Error
            ? nextError.message
            : "Unable to update order status.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleModalStatusSubmit() {
    if (!actionModal) {
      return;
    }

    if (actionModal.nextStatus === "cancelled" && !cancelReasonDraft.trim()) {
      setActionFeedback({
        type: "error",
        text: "Select a cancellation reason before cancelling the order.",
      });
      return;
    }

    if (actionModal.nextStatus === "refunded" && !refundReasonDraft.trim()) {
      setActionFeedback({
        type: "error",
        text: "Enter a refund reason before marking the order as refunded.",
      });
      return;
    }

    setUpdatingId(actionModal.order.id);
    setActionFeedback(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
          `/admin/orders/${actionModal.order.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              currentStatus: actionModal.nextStatus,
              cancellationReason:
                actionModal.nextStatus === "cancelled"
                  ? cancelReasonDraft.trim()
                  : undefined,
              cancellationNote:
                actionModal.nextStatus === "cancelled"
                  ? cancelNoteDraft.trim()
                  : undefined,
              refundReason:
                actionModal.nextStatus === "refunded"
                  ? refundReasonDraft.trim()
                  : undefined,
            }),
          },
        );

      const updatedOrder = normalizeAdminOrder(
        response.data.order as Record<string, unknown>,
      );

      syncOrderState(updatedOrder);
      setActionFeedback({
        type: "success",
        text: `Order ${updatedOrder.orderNumber} updated to ${formatOrderStatusLabel(updatedOrder.currentStatus || actionModal.nextStatus)}.`,
      });
      closeActionModal();
    } catch (nextError) {
      setActionFeedback({
        type: "error",
        text:
          nextError instanceof Error
            ? nextError.message
            : "Unable to update order status.",
      });
    } finally {
      setUpdatingId(null);
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
          logOrdersResponse("syncOrders response", response.data);
          setOrders(
            response.data.orders.map((order, index) =>
              normalizeAdminOrder(order as Record<string, unknown>, index),
            ),
          );
          setStatusDrafts(
            Object.fromEntries(
              response.data.orders.map((order, index) => {
                const normalizedOrder = normalizeAdminOrder(
                  order as Record<string, unknown>,
                  index,
                );

                return [
                  normalizedOrder.id,
                  String(normalizedOrder.currentStatus || "placed").trim() ||
                    "placed",
                ];
              }),
            ),
          );
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

  const statusOptions = orderStatusOptions;

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
      } else if (normalizedStatus === "confirmed") {
        summary.confirmed += 1;
      } else if (normalizedStatus === "shipped") {
        summary.shipped += 1;
      } else if (normalizedStatus === "out_for_delivery") {
        summary.outForDelivery += 1;
      } else if (normalizedStatus === "delivered") {
        summary.delivered += 1;
      } else if (normalizedStatus === "cancelled") {
        summary.cancelled += 1;
      } else if (normalizedStatus === "refunded") {
        summary.refunded += 1;
      }

      return summary;
    },
    {
      placed: 0,
      confirmed: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    },
  );

  const filteredOrders = dateFilteredOrders.filter((order) => {
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
    const orderStatus = normalizeOrderStatus(
      order.currentStatus || order.paymentStatus,
    );
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
    <div className="space-y-1">
      <AdminPageHeader
        title="Orders"
        description="Track fulfillment, payment state, customer contact details, and recent order activity from one compact queue."
      />

      <AdminPanel>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Matching orders",
                  value: filteredOrders.length,
                  tone: "bg-[#f8faf6]",
                },
                {
                  label: "Placed",
                  value: statusCounts.placed,
                  tone: "bg-[#f8faf6]",
                },
                {
                  label: "Confirmed",
                  value: statusCounts.confirmed,
                  tone: "bg-[#f4fbf1]",
                },
                {
                  label: "Shipped",
                  value: statusCounts.shipped,
                  tone: "bg-[#f4fbf1]",
                },
                {
                  label: "Out for delivery",
                  value: statusCounts.outForDelivery,
                  tone: "bg-[#f6fbff]",
                },
                {
                  label: "Delivered",
                  value: statusCounts.delivered,
                  tone: "bg-[#eef8f0]",
                },
                {
                  label: "Cancelled",
                  value: statusCounts.cancelled,
                  tone: "bg-[#fff6f4]",
                },
                {
                  label: "Refunded",
                  value: statusCounts.refunded,
                  tone: "bg-[#fff8f0]",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={`rounded-[1rem] border border-gray-300 px-4 py-4`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {metric.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-gray-800">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 lg:flex lg:flex-1 lg:items-center">
              <AdminTextInput
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by order number, tracking code, customer, phone, or status"
                className="lg:max-w-xl"
              />
              <AdminSelect
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="lg:w-[220px]"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </AdminSelect>
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
                className="lg:w-[220px]"
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="custom">Custom date range</option>
              </AdminSelect>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={exportOrdersAsExcel}
              >
                Export Excel
              </AdminActionButton>
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={exportOrdersAsPdf}
              >
                Export PDF
              </AdminActionButton>
            </div>
          </div>

          {dateRangeFilter === "custom" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-[88px] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                Date range
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <AdminTextInput
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="sm:w-[180px]"
                />
                <AdminTextInput
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="sm:w-[180px]"
                />
              </div>
            </div>
          ) : null}

          {actionFeedback ? (
            <div
              className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${
                actionFeedback.type === "error"
                  ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
                  : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
              }`}
            >
              {actionFeedback.text}
            </div>
          ) : null}
        </div>
      </AdminPanel>

      {!filteredOrders.length ? (
        <AdminEmptyCard
          title="No orders found"
          description="Try another search query. Orders will appear here as soon as customers place them."
        />
      ) : (
        <div className="space-y-4">
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Order
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Delivery
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Order update
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-300 align-top transition hover:bg-[rgba(0,0,0,0.03)]"
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-[190px]">
                          <p className="text-sm font-bold text-gray-700">
                            {order.orderNumber}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {order.trackingCode || "No tracking code"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Created {formatCompactDate(order.createdAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <p className="text-sm font-semibold text-gray-700">
                            {order.fullName}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {order.phoneNumber || "No phone"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {order.email || "No email"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[160px]">
                          <p className="text-sm font-semibold text-gray-700">
                            {formatCompactDate(order.deliveryDate || order.createdAt)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {order.paymentMethodLabel ||
                              order.paymentMethod ||
                              "Payment method unavailable"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[140px]">
                          <p className="text-sm font-semibold text-gray-700">
                            {formatAdminCurrency(resolveOrderTotal(order.pricing))}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Delivery{" "}
                            {formatAdminCurrency(resolveDeliveryCharge(order.pricing))}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[220px] flex-col items-start gap-2">
                          <AdminStatusPill
                            status={order.currentStatus || order.paymentStatus}
                          />
                          {order.paymentStatus &&
                          order.paymentStatus !== order.currentStatus ? (
                            <span className="text-xs text-gray-500">
                              Payment:{" "}
                              {String(order.paymentStatus).replaceAll("_", " ")}
                            </span>
                          ) : null}
                          {order.currentStatus === "cancelled" &&
                          order.cancellationReason ? (
                            <span className="text-xs text-[#9d3b2d]">
                              Reason:{" "}
                              {cancellationReasonOptions.find(
                                (reason) => reason.value === order.cancellationReason,
                              )?.label || order.cancellationReason.replaceAll("_", " ")}
                            </span>
                          ) : null}
                          {order.currentStatus === "refunded" && order.refundReason ? (
                            <span className="text-xs text-[#9d3b2d]">
                              Refund: {order.refundReason}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[260px] items-center gap-2">
                          <AdminSelect
                            value={
                              statusDrafts[order.id] ||
                              String(order.currentStatus || "placed").trim() ||
                              "placed"
                            }
                            onChange={(event) =>
                              setStatusDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [order.id]: event.target.value,
                              }))
                            }
                            className="min-w-[170px]"
                          >
                            {orderStatusOptions.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </AdminSelect>
                          <AdminActionButton
                            onClick={() => void handleQuickStatusUpdate(order)}
                            disabled={updatingId === order.id}
                            className="min-w-[78px] px-3 py-2"
                          >
                            {updatingId === order.id ? "Saving..." : "Update"}
                          </AdminActionButton>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[120px]">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex items-center justify-center rounded-full bg-[#207958] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>

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

      {actionModal ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgba(15,24,12,0.2)] px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close order action dialog"
            onClick={closeActionModal}
          />
          <div className="relative z-[131] w-full max-w-2xl rounded-[1.25rem] border border-[var(--admin-line)] bg-white p-6 shadow-[0_20px_60px_rgba(20,30,18,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
              {actionModal.nextStatus === "cancelled" ? "Cancel order" : "Refund order"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              {actionModal.order.orderNumber}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              {actionModal.nextStatus === "cancelled"
                ? "Choose the cancellation reason before the order is cancelled."
                : "Add the refund reason before the order is marked as refunded."}
            </p>

            {actionModal.nextStatus === "cancelled" ? (
              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Cancellation reason
                  </span>
                  <div className="mt-2">
                    <select
                      value={cancelReasonDraft}
                      onChange={(event) => setCancelReasonDraft(event.target.value)}
                      className={inputClassName()}
                    >
                      <option value="">Select cancellation reason</option>
                      {cancellationReasonOptions.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Cancellation note
                  </span>
                  <div className="mt-2">
                    <textarea
                      value={cancelNoteDraft}
                      onChange={(event) => setCancelNoteDraft(event.target.value)}
                      className={textareaClassName()}
                      placeholder="Optional internal note for this cancellation."
                    />
                  </div>
                </label>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--admin-ink)]">
                    Refund reason
                  </span>
                  <div className="mt-2">
                    <textarea
                      value={refundReasonDraft}
                      onChange={(event) => setRefundReasonDraft(event.target.value)}
                      className={textareaClassName()}
                      placeholder="Explain why this order is being refunded."
                    />
                  </div>
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={closeActionModal}
                disabled={updatingId === actionModal.order.id}
              >
                Close
              </AdminActionButton>
              <AdminActionButton
                type="button"
                tone={actionModal.nextStatus === "cancelled" ? "danger" : "primary"}
                onClick={() => void handleModalStatusSubmit()}
                disabled={updatingId === actionModal.order.id}
              >
                {updatingId === actionModal.order.id
                  ? "Saving..."
                  : actionModal.nextStatus === "cancelled"
                    ? "Confirm cancellation"
                    : "Confirm refund"}
              </AdminActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
