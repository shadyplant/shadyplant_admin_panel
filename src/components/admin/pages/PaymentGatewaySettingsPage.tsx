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
        description="Switch the live gateway "
      />

      {loading ? <AdminLoadingCard label="Loading gateway settings..." /> : null}
      {!loading && error ? <AdminErrorCard message={error} /> : null}

      {!loading && !error && settings ? (
        <AdminPanel className="space-y-5">
     

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
                      ? "border-[#207958] bg-gray-50"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Provider
                      </p>
                     <div className="mt-2 flex items-center gap-3">
                       {provider.provider === "cashfree" ? (
                        <img
                          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTzmTNeg4lYC1Vk0o2XxyyqXJxHFOciQ2DFfxktlGZ3ec8S1JCPVLgdh2s&s=10"
                          alt={provider.label}
                          className="h-8 w-8"
                        />
                      ) : (
                        <img
                          src="https://i0.wp.com/www.plansinfo.com/blog/wp-content/uploads/2018/01/phonepe-e1520537823958.png?fit=200%2C200&ssl=1"
                          alt={provider.label}
                          className="h-8 w-8"
                        />
                      )}
                      <h2 className="mt-2 text-2xl font-semibold text-gray-800">
                        {provider.label}
                      </h2>
                     </div>
                    </div>
                    <AdminStatusPill status={isActive ? "active" : "inactive"} />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[0.9rem] bg-white/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Checkout
                      </p>
                      <p className="mt-2 text-sm font-semibold text-gray-800">
                        {provider.isCheckoutConfigured ? "Configured" : "Missing credentials"}
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] bg-white/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Webhook
                      </p>
                      <p className="mt-2 text-sm font-semibold text-gray-800">
                        {provider.isWebhookConfigured ? "Configured" : "Needs setup"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-gray-500">
                    Runtime mode: <span className="font-semibold text-gray-800">{settings.mode}</span>
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
