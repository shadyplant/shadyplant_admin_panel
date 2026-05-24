"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSectionTitle,
  AdminStatusPill,
} from "@/components/admin/AdminUi";
import type { AdminPaymentGatewaySettings, ApiResponse } from "@/lib/admin-api";

export default function PaymentGatewaySettingsPage() {
  const { authorizedRequest } = useAdminAuth();
  const [settings, setSettings] = useState<AdminPaymentGatewaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await authorizedRequest<ApiResponse<{ settings: AdminPaymentGatewaySettings }>>(
          "/admin/settings/payment-gateway",
        );

      setSettings(response.data.settings);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load payment gateway settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void loadSettings();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loadSettings]);

  async function handleSwitchProvider(provider: string) {
    setSavingProvider(provider);
    setError("");
    setMessage("");

    try {
      const response =
        await authorizedRequest<ApiResponse<{ settings: AdminPaymentGatewaySettings }>>(
          "/admin/settings/payment-gateway",
          {
            method: "PATCH",
            body: JSON.stringify({ provider }),
          },
        );

      setSettings(response.data.settings);
      setMessage(`${provider === "cashfree" ? "Cashfree" : "PhonePe"} is now active.`);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update the active payment gateway.",
      );
    } finally {
      setSavingProvider("");
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Configuration"
        title="Payment Gateway"
        description="Switch the live gateway used for online checkout without changing the codebase. Customer checkout and admin-assisted payment flows will use the active provider."
      />

      {loading ? <AdminLoadingCard label="Loading gateway settings..." /> : null}
      {!loading && error ? <AdminErrorCard message={error} /> : null}

      {!loading && !error && settings ? (
        <AdminPanel className="space-y-5">
          <AdminSectionTitle
            title="Active gateway"
            description="Only one online gateway is active at a time. Existing payment attempts keep their original provider for verification."
          />

          {message ? (
            <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-ink)]">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {settings.providers.map((provider) => {
              const isActive = settings.activeProvider === provider.provider;
              const isSaving = savingProvider === provider.provider;

              return (
                <div
                  key={provider.provider}
                  className={`rounded-[1rem] border p-5 ${
                    isActive
                      ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
                      : "border-[var(--admin-line)] bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                        Provider
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                        {provider.label}
                      </h2>
                    </div>
                    <AdminStatusPill status={isActive ? "active" : "inactive"} />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[0.9rem] bg-white/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                        Checkout
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">
                        {provider.isCheckoutConfigured ? "Configured" : "Missing credentials"}
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-white/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                        Webhook
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">
                        {provider.isWebhookConfigured ? "Configured" : "Needs setup"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-[var(--admin-muted)]">
                    Runtime mode: <span className="font-semibold text-[var(--admin-ink)]">{settings.mode}</span>
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <AdminActionButton
                      type="button"
                      tone={isActive ? "secondary" : "primary"}
                      onClick={() => void handleSwitchProvider(provider.provider)}
                      disabled={isActive || isSaving || !provider.isCheckoutConfigured}
                    >
                      {isSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Switching...
                        </span>
                      ) : isActive ? (
                        "Currently active"
                      ) : (
                        `Activate ${provider.label}`
                      )}
                    </AdminActionButton>
                  </div>
                </div>
              );
            })}
          </div>
        </AdminPanel>
      ) : null}
    </div>
  );
}
