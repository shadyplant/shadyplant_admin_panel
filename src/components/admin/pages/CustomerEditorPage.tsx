"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminActionButton, AdminPanel, AdminTextarea } from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName } from "@/components/admin/Forms";
import type { AdminCustomer, ApiResponse } from "@/lib/admin-api";
import {
  formatAdminDate,
  normalizeObjectRecord,
  prettyJson,
  safeJsonParse,
} from "@/lib/admin-utils";

type CustomerEditorPageProps = {
  customerId: string;
};

type CustomerFormState = {
  fullName: string;
  phoneNumber: string;
  isVerified: boolean;
  deliveryAddress: string;
  billingDetails: string;
};

function mapCustomerToForm(customer: AdminCustomer): CustomerFormState {
  return {
    fullName: customer.fullName || "",
    phoneNumber: customer.phoneNumber || "",
    isVerified: Boolean(customer.isVerified),
    deliveryAddress: prettyJson(customer.deliveryAddress || {}),
    billingDetails: prettyJson(customer.billingDetails || {}),
  };
}

function buildPayload(form: CustomerFormState) {
  return {
    fullName: form.fullName.trim(),
    phoneNumber: form.phoneNumber.trim(),
    isVerified: form.isVerified,
    deliveryAddress: safeJsonParse(form.deliveryAddress, {}, normalizeObjectRecord),
    billingDetails: safeJsonParse(form.billingDetails, {}, normalizeObjectRecord),
  };
}

export default function CustomerEditorPage({ customerId }: CustomerEditorPageProps) {
  const { authorizedRequest } = useAdminAuth();
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [form, setForm] = useState<CustomerFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadCustomer() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          `/admin/customers/${customerId}`,
        );
      setCustomer(response.data.customer);
      setForm(mapCustomerToForm(response.data.customer));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load customer details.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncCustomer() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
            `/admin/customers/${customerId}`,
          );

        if (cancelled) {
          return;
        }

        setCustomer(response.data.customer);
        setForm(mapCustomerToForm(response.data.customer));
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load customer details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncCustomer();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, customerId]);

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
        await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          `/admin/customers/${customerId}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setCustomer(response.data.customer);
      setForm(mapCustomerToForm(response.data.customer));
      setSuccessMessage("Customer updated successfully.");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save customer changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading customer details..." />;
  }

  if (error || !customer || !form) {
    return (
      <AdminErrorCard message={error || "Customer not found."} onRetry={loadCustomer} />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Customer Detail"
        title={customer.fullName}
        description={`Customer account created ${formatAdminDate(customer.createdAt)} through ${customer.authProvider}.`}
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <AdminPanel>
          <FormGrid>
            <FormField label="Full name">
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                className={inputClassName()}
              />
            </FormField>
            <FormField label="Email">
              <input
                value={customer.email || ""}
                readOnly
                className={`${inputClassName()} bg-[var(--admin-chip)]`}
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
            <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Verification
              </p>
              <label className="mt-4 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isVerified}
                  onChange={(event) =>
                    setForm({ ...form, isVerified: event.target.checked })
                  }
                />
                Mark customer as verified
              </label>
            </div>
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton type="submit" tone="primary" disabled={saving}>
              {saving ? "Saving..." : "Save customer"}
            </AdminActionButton>
            <Link
              href="/customers"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to customers
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
          </AdminPanel>
          <AdminPanel>
            <FormField label="Billing details JSON">
              <AdminTextarea
                value={form.billingDetails}
                onChange={(event) =>
                  setForm({ ...form, billingDetails: event.target.value })
                }
              />
            </FormField>
          </AdminPanel>
        </div>
      </form>
    </div>
  );
}
