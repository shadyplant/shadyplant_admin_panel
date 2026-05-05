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
  paymentStatus: string;
  deliveryAddress: string;
  vehicle: string;
  orderItems: string;
  billingDetails: string;
  deliveryLocation: string;
  pricing: string;
};

function mapOrderToForm(order: AdminOrder): OrderFormState {
  return {
    fullName: order.fullName || "",
    email: order.email || "",
    phoneNumber: order.phoneNumber || "",
    deliveryDate: order.deliveryDate
      ? new Date(order.deliveryDate).toISOString().slice(0, 16)
      : "",
    paymentStatus: order.paymentStatus || "",
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
    paymentStatus: form.paymentStatus.trim(),
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
        description="Update core order contact data, payment status, delivery date, item payloads, and supporting operational JSON."
      />

      <AdminPanel>
        <AdminInfoList
          items={[
            { label: "Tracking", value: order.trackingCode || "Not assigned" },
            {
              label: "Current status",
              value: order.currentStatus || order.paymentStatus || "Not available",
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
              Quick payment actions
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              The backend currently supports updating payment state and structured order payload fields. The delivery progress timeline below is derived from server data and is not directly editable from this panel yet.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
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

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel>
            <FormField label="Delivery address JSON">
              <AdminTextarea
                value={form.deliveryAddress}
                onChange={(event) =>
                  setForm({ ...form, deliveryAddress: event.target.value })
                }
              />
            </FormField>
            <FormField label="Vehicle JSON">
              <AdminTextarea
                value={form.vehicle}
                onChange={(event) => setForm({ ...form, vehicle: event.target.value })}
                className="mt-5"
              />
            </FormField>
            <FormField label="Delivery location JSON">
              <AdminTextarea
                value={form.deliveryLocation}
                onChange={(event) =>
                  setForm({ ...form, deliveryLocation: event.target.value })
                }
                className="mt-5"
              />
            </FormField>
          </AdminPanel>

          <AdminPanel>
            <FormField label="Order items JSON">
              <AdminTextarea
                value={form.orderItems}
                onChange={(event) => setForm({ ...form, orderItems: event.target.value })}
              />
            </FormField>
            <FormField label="Billing details JSON">
              <AdminTextarea
                value={form.billingDetails}
                onChange={(event) =>
                  setForm({ ...form, billingDetails: event.target.value })
                }
                className="mt-5"
              />
            </FormField>
            <FormField label="Pricing JSON">
              <AdminTextarea
                value={form.pricing}
                onChange={(event) => setForm({ ...form, pricing: event.target.value })}
                className="mt-5"
              />
            </FormField>
          </AdminPanel>
        </div>

        {Array.isArray(order.trackingTimeline) && order.trackingTimeline.length ? (
          <AdminPanel>
            <p className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              Tracking history
            </p>
            <div className="mt-5 space-y-3">
              {order.trackingTimeline.map((step: Record<string, unknown>, index: number) => (
                <div
                  key={`${String(step.status || "step")}-${index}`}
                  className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4"
                >
                  <p className="text-sm font-bold text-[var(--admin-ink)]">
                    {String(step.title || step.status || "Timeline event")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
                    {String(step.description || "No details available")}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                    {formatAdminDate(String(step.date || step.createdAt || ""))}
                  </p>
                </div>
              ))}
            </div>
          </AdminPanel>
        ) : null}
      </form>
    </div>
  );
}
