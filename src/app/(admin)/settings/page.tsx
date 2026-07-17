import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminUi";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System Settings"
        title="Settings"
        description="Manage payment configuration and other system controls."
      />

      <AdminPanel className="space-y-3 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
          Payments
        </p>
        <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
          Payment Gateway
        </h2>
        <p className="text-sm leading-6 text-[var(--admin-muted)]">
          Configure the active payment provider and checkout settings.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/settings/payment-gateway"
            className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Open gateway settings
          </Link>
          <Link
            href="/delivery-charges"
            className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
          >
            Open delivery charges
          </Link>
        </div>
      </AdminPanel>
    </div>
  );
}
