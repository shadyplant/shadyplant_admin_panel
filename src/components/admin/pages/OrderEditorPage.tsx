"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Circle, Clock3 } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminInfoList,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName } from "@/components/admin/Forms";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatAdminDate,
  normalizeObjectArray,
  normalizeObjectRecord,
  prettyJson,
  resolveDeliveryCharge,
  resolveOrderTotal,
  safeJsonParse,
} from "@/lib/admin-utils";
import { canManageOrders } from "@/lib/admin-permissions";

type OrderEditorPageProps = {
  orderId: string;
};

type AdminOrderLineItem = {
  id: string;
  name: string;
  variantLabel: string;
  packLabel: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  category: string;
};

type OrderFormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  deliveryDate: string;
  currentStatus: string;
  paymentStatus: string;
  cancellationReason: string;
  cancellationNote: string;
  refundReason: string;
  refundRequestNote: string;
  trackingEventStatus: string;
  trackingEventMessage: string;
  deliveryAddress: string;
  vehicle: string;
  orderItems: string;
  billingDetails: string;
  deliveryLocation: string;
  pricing: string;
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

function formatOrderStatusLabel(status: string) {
  return (
    orderStatusOptions.find((option) => option.value === status)?.label ||
    status.replaceAll("_", " ")
  );
}

function applyPrimaryStatus(
  form: OrderFormState,
  status: string,
): OrderFormState {
  return {
    ...form,
    currentStatus: status,
    trackingEventStatus: status,
  };
}

function isReachedTrackingStep(state: string | null | undefined) {
  return state === "complete" || state === "current";
}

function formatTrackingStepState(state: string | null | undefined) {
  if (state === "complete") {
    return "Completed";
  }

  if (state === "current") {
    return "Current";
  }

  return "Pending";
}

function normalizeStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveNumberValue(...values: unknown[]) {
  for (const value of values) {
    const nextValue = Number(value);
    if (Number.isFinite(nextValue)) {
      return nextValue;
    }
  }

  return 0;
}

function normalizeOrderItems(items: Array<Record<string, unknown>> = []): AdminOrderLineItem[] {
  return items.map((item, index) => {
    const quantity = Math.max(
      1,
      Math.floor(resolveNumberValue(item.quantity, item.qty, 1)),
    );
    const unitPrice = Math.max(
      0,
      resolveNumberValue(item.unitPrice, item.price, item.finalRate, item.salePrice, 0),
    );
    const subtotal = Math.max(
      0,
      resolveNumberValue(item.subtotal, item.total, item.lineTotal, unitPrice * quantity),
    );

    return {
      id:
        normalizeStringValue(item.id) ||
        normalizeStringValue(item.productId) ||
        `order-item-${index}`,
      name:
        normalizeStringValue(item.name) ||
        normalizeStringValue(item.productName) ||
        normalizeStringValue(item.itemName) ||
        `Item ${index + 1}`,
      variantLabel: normalizeStringValue(item.variantLabel),
      packLabel: normalizeStringValue(item.packLabel),
      quantity,
      unitPrice,
      subtotal,
      category: normalizeStringValue(item.category),
    };
  });
}

function formatRefundRequestStatusLabel(status: AdminOrder["refundRequestStatus"]) {
  switch (status) {
    case "pending_submission":
      return "Awaiting customer details";
    case "submitted":
      return "Submitted";
    case "resubmit_required":
      return "Resubmission requested";
    case "refunded":
      return "Refunded";
    default:
      return "Not started";
  }
}

function mapOrderToForm(order: AdminOrder): OrderFormState {
  return {
    fullName: order.fullName || "",
    email: order.email || "",
    phoneNumber: order.phoneNumber || "",
    deliveryDate: order.deliveryDate
      ? new Date(order.deliveryDate).toISOString().slice(0, 16)
      : "",
    currentStatus: order.currentStatus || "placed",
    paymentStatus: order.paymentStatus || "",
    cancellationReason: order.cancellationReason || "",
    cancellationNote: order.cancellationNote || "",
    refundReason: order.refundReason || "",
    refundRequestNote: order.refundRequestNote || "",
    trackingEventStatus: order.currentStatus || "placed",
    trackingEventMessage: "",
    deliveryAddress: prettyJson(order.deliveryAddress || {}),
    vehicle: prettyJson(order.vehicle || {}),
    orderItems: prettyJson(order.orderItems || []),
    billingDetails: prettyJson(order.billingDetails || {}),
    deliveryLocation: prettyJson(order.deliveryLocation || {}),
    pricing: prettyJson(order.pricing || {}),
  };
}

function buildPayload(form: OrderFormState) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
    deliveryDate: form.deliveryDate ? new Date(form.deliveryDate).toISOString() : undefined,
    currentStatus: form.currentStatus.trim(),
    paymentStatus: form.paymentStatus.trim(),
    cancellationReason: form.cancellationReason.trim(),
    cancellationNote: form.cancellationNote.trim(),
    refundReason: form.refundReason.trim(),
    trackingEventStatus: form.trackingEventStatus.trim(),
    trackingEventMessage: form.trackingEventMessage.trim(),
    deliveryAddress: safeJsonParse(form.deliveryAddress, {}, normalizeObjectRecord),
    vehicle: safeJsonParse(form.vehicle, {}, normalizeObjectRecord),
    orderItems: safeJsonParse(form.orderItems, [], normalizeObjectArray),
    billingDetails: safeJsonParse(form.billingDetails, {}, normalizeObjectRecord),
    deliveryLocation: safeJsonParse(form.deliveryLocation, {}, normalizeObjectRecord),
    pricing: safeJsonParse(form.pricing, {}, normalizeObjectRecord),
  };
}

export default function OrderEditorPage({ orderId }: OrderEditorPageProps) {
  const { authorizedRequest, staff } = useAdminAuth();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [form, setForm] = useState<OrderFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowOrderUpdates = canManageOrders(staff?.role);

  async function loadOrder() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
          `/admin/orders/${orderId}`,
        );
      setOrder(response.data.order);
      setForm(mapOrderToForm(response.data.order));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load order details.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncOrder() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
            `/admin/orders/${orderId}`,
          );

        if (cancelled) {
          return;
        }

        setOrder(response.data.order);
        setForm(mapOrderToForm(response.data.order));
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load order details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncOrder();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, orderId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
          `/admin/orders/${orderId}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setOrder(response.data.order);
      setForm(mapOrderToForm(response.data.order));
      setSuccessMessage("Order updated successfully.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save order changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRefundAction(action: "request_resubmit" | "mark_refunded") {
    if (!order || !form) {
      return;
    }

    if (action === "request_resubmit" && !form.refundRequestNote.trim()) {
      setError("Add a refund note before asking the customer to resubmit details.");
      setSuccessMessage(null);
      return;
    }

    if (action === "mark_refunded" && !form.refundReason.trim()) {
      setError("Refund reason is required before marking this order as refunded.");
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ order: AdminOrder }>>(
          `/admin/orders/${order.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              refundAccountAction: action,
              refundRequestNote: form.refundRequestNote.trim(),
              refundReason: form.refundReason.trim(),
            }),
          },
        );

      setOrder(response.data.order);
      setForm(mapOrderToForm(response.data.order));
      setSuccessMessage(
        action === "mark_refunded"
          ? "Order marked as refunded successfully."
          : "Customer has been asked to resubmit refund account details.",
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update refund details.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading order details..." />;
  }

  if (error || !order || !form) {
    return <AdminErrorCard message={error || "Order not found."} onRetry={loadOrder} />;
  }

  const normalizedOrderItems = normalizeOrderItems(order.orderItems || []);
  const totalOrderedQuantity = normalizedOrderItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const refundAccountDetails = order.refundAccountDetails || null;
  const canRequestRefundResubmit =
    order.currentStatus === "cancelled" &&
    order.refundRequestStatus === "submitted" &&
    Boolean(refundAccountDetails);
  const canMarkRefunded =
    order.currentStatus === "cancelled" &&
    order.refundRequestStatus === "submitted" &&
    Boolean(refundAccountDetails);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Order Detail"
        title={order.orderNumber}
        description="Update core order contact data, payment status, and delivery scheduling from one place."
      />

      <AdminPanel>
        <AdminInfoList
          items={[
            { label: "Tracking", value: order.trackingCode || "Not assigned" },
            {
              label: "Current status",
              value: order.currentStatus
                ? formatOrderStatusLabel(order.currentStatus)
                : order.paymentStatus || "Not available",
            },
            {
              label: "Created",
              value: formatAdminDate(order.createdAt),
            },
            {
              label: "Order total",
              value: formatAdminCurrency(resolveOrderTotal(order.pricing)),
            },
            {
              label: "Delivery charge",
              value: formatAdminCurrency(resolveDeliveryCharge(order.pricing)),
            },
            {
              label: "Ordered items",
              value: normalizedOrderItems.length
                ? `${normalizedOrderItems.length} line items`
                : "No line items",
            },
            {
              label: "Total quantity",
              value: totalOrderedQuantity || order.quantitySqft || 0,
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              Ordered items
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              Review exactly what the customer ordered, including quantity and line amount.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm">
            <p className="font-semibold text-[var(--admin-ink)]">
              {normalizedOrderItems.length} items
            </p>
            <p className="mt-1 text-[var(--admin-muted)]">
              Total quantity: {totalOrderedQuantity}
            </p>
          </div>
        </div>

        {normalizedOrderItems.length ? (
          <div className="mt-6 space-y-3">
            {normalizedOrderItems.map((item, index) => (
              <div
                key={item.id}
                className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[linear-gradient(180deg,#ffffff,#f7faf4)] px-4 py-4 shadow-[0_14px_30px_rgba(18,43,16,0.04)]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] px-2 text-xs font-black text-[var(--admin-accent)]">
                        {index + 1}
                      </span>
                      <p className="text-base font-black tracking-[-0.03em] text-[var(--admin-ink)]">
                        {item.name}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.variantLabel ? (
                        <span className="inline-flex items-center rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#3257a8]">
                          {item.variantLabel}
                        </span>
                      ) : null}
                      {item.packLabel ? (
                        <span className="inline-flex items-center rounded-full bg-[#f4f7ec] px-3 py-1 text-xs font-semibold text-[var(--admin-muted)]">
                          {item.packLabel}
                        </span>
                      ) : null}
                      {item.category ? (
                        <span className="inline-flex items-center rounded-full bg-[#fff3df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#946100]">
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm md:min-w-[240px] md:grid-cols-3">
                    <div className="rounded-[0.95rem] border border-[var(--admin-line)] bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                        Qty
                      </p>
                      <p className="mt-2 text-base font-black text-[var(--admin-ink)]">
                        {item.quantity}
                      </p>
                    </div>
                    <div className="rounded-[0.95rem] border border-[var(--admin-line)] bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                        Unit
                      </p>
                      <p className="mt-2 text-base font-black text-[var(--admin-ink)]">
                        {formatAdminCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div className="rounded-[0.95rem] border border-[var(--admin-line)] bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                        Line total
                      </p>
                      <p className="mt-2 text-base font-black text-[var(--admin-ink)]">
                        {formatAdminCurrency(item.subtotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4 text-sm text-[var(--admin-muted)]">
            No ordered line items were found on this order. If this order was created from checkout, that indicates an upstream order payload issue.
          </div>
        )}
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              Refund account details
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              Review the customer&apos;s submitted account details, request a corrected resubmission, or mark the refund as completed.
            </p>
          </div>
          <div className="rounded-full bg-[var(--admin-chip)] px-4 py-2 text-sm font-semibold text-[var(--admin-ink)]">
            {formatRefundRequestStatusLabel(order.refundRequestStatus)}
          </div>
        </div>

        {refundAccountDetails ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Name as on account
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--admin-ink)]">
                {refundAccountDetails.accountHolderName || "Not submitted"}
              </p>
            </div>
            <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Bank name
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--admin-ink)]">
                {refundAccountDetails.bankName || "Not submitted"}
              </p>
            </div>
            <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                Account number
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--admin-ink)]">
                {refundAccountDetails.accountNumber || "Not submitted"}
              </p>
            </div>
            <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                IFSC code
              </p>
              <p className="mt-2 text-base font-semibold uppercase text-[var(--admin-ink)]">
                {refundAccountDetails.ifscCode || "Not submitted"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4 text-sm text-[var(--admin-muted)]">
            Customer refund account details have not been submitted yet.
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
              Submitted at
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--admin-ink)]">
              {order.refundSubmittedAt ? formatAdminDate(order.refundSubmittedAt) : "Not submitted"}
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
              Resubmit requested at
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--admin-ink)]">
              {order.refundResubmitRequestedAt
                ? formatAdminDate(order.refundResubmitRequestedAt)
                : "No resubmission requested"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FormField label="Refund note for customer">
            <AdminTextarea
              value={form.refundRequestNote}
              onChange={(event) =>
                setForm({ ...form, refundRequestNote: event.target.value })
              }
              className="min-h-[110px]"
              placeholder="Account number mismatch. Please submit the correct details."
            />
          </FormField>
          <FormField label="Refund reason">
            <AdminTextarea
              value={form.refundReason}
              onChange={(event) =>
                setForm({ ...form, refundReason: event.target.value })
              }
              className="min-h-[110px]"
              placeholder="Refund approved after cancellation review."
            />
          </FormField>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <AdminActionButton
            type="button"
            tone="secondary"
            onClick={() => handleRefundAction("request_resubmit")}
            disabled={saving || !allowOrderUpdates || !canRequestRefundResubmit}
          >
            Ask Resubmit
          </AdminActionButton>
          <AdminActionButton
            type="button"
            tone="primary"
            onClick={() => handleRefundAction("mark_refunded")}
            disabled={saving || !allowOrderUpdates || !canMarkRefunded}
          >
            Mark Refunded
          </AdminActionButton>
        </div>
      </AdminPanel>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <AdminPanel>
          <div className="mb-5 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--admin-ink)]">
              Quick fulfillment actions
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              Order progress is controlled from admin. Changing the primary
              fulfillment status updates the customer-facing order stage and
              triggers the status email for that primary stage.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
              Primary order status
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {orderStatusOptions.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setForm(applyPrimaryStatus(form, status.value))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    form.currentStatus === status.value
                      ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                      : "border-[var(--admin-line-strong)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-chip)]"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 rounded-[1rem] border border-[var(--admin-line)] bg-white p-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <FormField label="Add timeline note under status">
                <AdminSelect
                  value={form.trackingEventStatus}
                  onChange={(event) =>
                    setForm({ ...form, trackingEventStatus: event.target.value })
                  }
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </AdminSelect>
              </FormField>
              <FormField label="Timeline update note">
                <input
                  value={form.trackingEventMessage}
                  onChange={(event) =>
                    setForm({ ...form, trackingEventMessage: event.target.value })
                  }
                  className={inputClassName()}
                  placeholder="Fresh carpet grass is being cut, packed, and staged."
                />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-[var(--admin-muted)]">
              Timeline notes do not change the primary order status unless you
              also update the primary status above.
            </p>
            <p className="mt-5 text-sm font-semibold text-[var(--admin-ink)]">
              Quick payment actions
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {["pending", "paid", "failed", "cash_on_delivery", "pay_on_delivery", "refunded"].map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm({ ...form, paymentStatus: status })}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      form.paymentStatus === status
                        ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                        : "border-[var(--admin-line-strong)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-chip)]"
                    }`}
                  >
                    {status.replaceAll("_", " ")}
                  </button>
                ),
              )}
            </div>
          </div>

          <FormGrid>
            <FormField label="Customer name">
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className={inputClassName()}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClassName()}
              />
            </FormField>
            <FormField label="Phone number">
              <input
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm({ ...form, phoneNumber: event.target.value })
                }
                className={inputClassName()}
              />
            </FormField>
            <FormField label="Delivery date">
              <input
                type="datetime-local"
                value={form.deliveryDate}
                onChange={(event) =>
                  setForm({ ...form, deliveryDate: event.target.value })
                }
                className={inputClassName()}
              />
            </FormField>
            <FormField label="Current fulfillment status">
              <AdminSelect
                value={form.currentStatus}
                onChange={(event) =>
                  setForm(applyPrimaryStatus(form, event.target.value))
                }
              >
                {orderStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </AdminSelect>
            </FormField>
            <FormField label="Payment status">
              <AdminSelect
                value={form.paymentStatus}
                onChange={(event) =>
                  setForm({ ...form, paymentStatus: event.target.value })
                }
              >
                {[
                  "pending",
                  "paid",
                  "failed",
                  "cash_on_delivery",
                  "pay_on_delivery",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </AdminSelect>
            </FormField>
            <FormField label="Cancellation reason">
              <AdminSelect
                value={form.cancellationReason}
                onChange={(event) =>
                  setForm({ ...form, cancellationReason: event.target.value })
                }
              >
                <option value="">Select cancellation reason</option>
                {cancellationReasonOptions.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </AdminSelect>
            </FormField>
            <FormField label="Cancellation note">
              <AdminTextarea
                value={form.cancellationNote}
                onChange={(event) =>
                  setForm({ ...form, cancellationNote: event.target.value })
                }
                className="min-h-[110px]"
              />
            </FormField>
          </FormGrid>

          {(error || successMessage) && (
            <div
              className={`mt-5 rounded-[1rem] px-4 py-3 text-sm font-medium ${
                error
                  ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
                  : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
              }`}
            >
              {error || successMessage}
            </div>
          )}
          {!allowOrderUpdates ? (
            <div className="mt-5 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
              Your role can inspect orders, but order mutations should be handled by operations, manager, admin, or owner staff.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || !allowOrderUpdates}
            >
              {saving ? "Saving..." : "Save order"}
            </AdminActionButton>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to orders
            </Link>
          </div>
        </AdminPanel>

        {Array.isArray(order.trackingTimeline) && order.trackingTimeline.length ? (
          <AdminPanel>
            <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              Tracking history
            </p>
            <div className="mt-6 space-y-0">
              {order.trackingTimeline.map((step, index: number, timeline) => {
                const isReached = isReachedTrackingStep(step.state);
                const nextStep = timeline[index + 1];
                const nextStepReached = nextStep
                  ? isReachedTrackingStep(nextStep.state)
                  : false;

                return (
                  <div
                    key={`${step.key}-${index}`}
                    className="relative grid gap-4 pb-6 md:grid-cols-[32px_minmax(0,1fr)]"
                  >
                    {index !== timeline.length - 1 ? (
                      <div
                        className={`absolute left-[15px] top-8 w-px ${nextStepReached ? "bottom-0 bg-[var(--admin-accent)]" : "bottom-0 bg-[var(--admin-line)]"}`}
                      />
                    ) : null}

                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${
                        isReached
                          ? "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white"
                          : "border-[var(--admin-line-strong)] bg-white text-[var(--admin-muted)]"
                      }`}
                    >
                      {isReached ? (
                        <Check size={16} strokeWidth={3} />
                      ) : step.state === "current" ? (
                        <Clock3 size={16} />
                      ) : (
                        <Circle size={12} fill="currentColor" />
                      )}
                    </div>

                    <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[linear-gradient(180deg,#ffffff,#f7faf4)] px-4 py-4 shadow-[0_14px_30px_rgba(18,43,16,0.04)]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black tracking-[-0.03em] text-[var(--admin-ink)]">
                              {step.title}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                step.state === "current"
                                  ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                                  : isReached
                                    ? "bg-[#edf6ea] text-[#256233]"
                                    : "bg-[var(--admin-chip)] text-[var(--admin-muted)]"
                              }`}
                            >
                              {formatTrackingStepState(step.state)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                            {step.description || "No details available"}
                          </p>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)] md:text-right">
                          {step.occurredAt ? formatAdminDate(step.occurredAt) : "Pending"}
                        </p>
                      </div>

                      {Array.isArray(step.entries) && step.entries.length ? (
                        <div className="mt-4 space-y-3 border-t border-[var(--admin-line)] pt-4">
                          {step.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-[0.95rem] border border-[var(--admin-line)] bg-white px-3 py-3"
                            >
                              <p className="text-sm font-medium text-[var(--admin-ink)]">
                                {entry.message}
                              </p>
                              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                                {formatAdminDate(entry.timestamp)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminPanel>
        ) : null}
      </form>
    </div>
  );
}
