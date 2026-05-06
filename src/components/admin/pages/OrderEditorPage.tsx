"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminInfoList,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName } from "@/components/admin/Forms";
import type { AdminOrder, ApiResponse } from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatAdminDate,
  normalizeObjectArray,
  normalizeObjectRecord,
  prettyJson,
  resolveOrderTotal,
  safeJsonParse,
} from "@/lib/admin-utils";
import { canManageOrders } from "@/lib/admin-permissions";

type OrderEditorPageProps = {
  orderId: string;
};

type OrderFormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  deliveryDate: string;
  currentStatus: string;
  paymentStatus: string;
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
  { value: "confirmed", label: "Order confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
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

function mapOrderToForm(order: AdminOrder): OrderFormState {
  return {
    fullName: order.fullName || "",
    email: order.email || "",
    phoneNumber: order.phoneNumber || "",
    deliveryDate: order.deliveryDate
      ? new Date(order.deliveryDate).toISOString().slice(0, 16)
      : "",
    currentStatus: order.currentStatus || "confirmed",
    paymentStatus: order.paymentStatus || "",
    trackingEventStatus: order.currentStatus || "confirmed",
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

  if (loading) {
    return <AdminLoadingCard label="Loading order details..." />;
  }

  if (error || !order || !form) {
    return <AdminErrorCard message={error || "Order not found."} onRetry={loadOrder} />;
  }

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
          ]}
        />
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
              {["pending", "paid", "failed", "cash_on_delivery", "pay_on_delivery"].map(
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
            <div className="mt-5 space-y-3">
              {order.trackingTimeline.map((step, index: number) => (
                <div
                  key={`${step.key}-${index}`}
                  className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--admin-ink)]">
                      {step.title}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      {step.occurredAt ? formatAdminDate(step.occurredAt) : "Pending"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
                    {step.description || "No details available"}
                  </p>
                  {Array.isArray(step.entries) && step.entries.length ? (
                    <div className="mt-4 space-y-3">
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
              ))}
            </div>
          </AdminPanel>
        ) : null}
      </form>
    </div>
  );
}
