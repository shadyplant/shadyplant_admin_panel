"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { adminRequest, type AdminStaff, type ApiResponse } from "@/lib/admin-api";

type SetupStatusResponse = ApiResponse<{ isSetupComplete: boolean }>;
type SetupResponse = ApiResponse<{
  staff: AdminStaff;
  expiresIn: string;
}>;

export default function LoginPage() {
  const router = useRouter();
  const { login, setSession, hydrated, isAuthenticated, staff } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("Grass Green Nursery");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadSetupStatus() {
      setSetupLoading(true);

      try {
        const response = await adminRequest<SetupStatusResponse>(
          "/admin/auth/setup-status",
        );

        if (!cancelled) {
          setSetupRequired(!response.data.isSetupComplete);
        }
      } catch {
        if (!cancelled) {
          setSetupRequired(false);
        }
      } finally {
        if (!cancelled) {
          setSetupLoading(false);
        }
      }
    }

    void loadSetupStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (setupRequired) {
        const response = await adminRequest<SetupResponse>("/admin/auth/setup", {
          method: "POST",
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            organizationName: organizationName.trim(),
          }),
        });

        setSession(response.data.staff);
        setSetupRequired(false);
      } else {
        await login(email.trim(), password);
      }

      router.replace("/");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to sign in right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_40px_120px_rgba(14,31,13,0.12)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-[linear-gradient(145deg,#153f22,#275d31)] px-7 py-8 text-white sm:px-10 sm:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
            Grass Green Nursery
          </p>
          <h1 className="mt-4 max-w-md text-4xl font-black tracking-[-0.06em] sm:text-5xl">
            Admin Workspace
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/78 sm:text-base">
            Central control for products, services, order operations, customer
            support, review moderation, and organization staff.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              "Catalog control for e-commerce inventory",
              "Service management for nursery offerings",
              "Order, customer, and review handling in one flow",
              "Separate staff auth from customer accounts",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.4rem] border border-white/12 bg-white/8 p-4 text-sm leading-6 text-white/82 backdrop-blur"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
              {setupRequired ? "Initial Owner Setup" : "Staff Sign In"}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
              {setupRequired ? "Create the first admin owner" : "Manage the storefront"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">
              {setupRequired
                ? "No staff account exists yet. Create the first owner account for the organization, then use normal team management inside the admin console."
                : "Use your admin or team organization account. Customer accounts do not have access here."}
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {setupRequired ? (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">
                      Owner full name
                    </span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Owner name"
                      className="mt-2 w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none transition placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--admin-ink)]">
                      Organization name
                    </span>
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Grass Green Nursery"
                      className="mt-2 w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none transition placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                      required
                    />
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">
                  Staff email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@grassgreen.in"
                  className="mt-2 w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none transition placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[var(--admin-ink)]">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your staff password"
                  className="mt-2 w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none transition placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                  required
                />
              </label>

              {error ? (
                <div className="rounded-[1rem] border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-medium text-[#a73d31]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || setupLoading}
                className="w-full rounded-full bg-[var(--admin-accent)] px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setupLoading
                  ? "Checking setup..."
                  : isSubmitting
                    ? setupRequired
                      ? "Creating owner..."
                      : "Signing in..."
                    : setupRequired
                      ? "Create admin owner"
                      : "Sign in to admin"}
              </button>
            </form>

            {hydrated && isAuthenticated && staff ? (
              <div className="mt-6 rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
                Active session detected for{" "}
                <span className="font-semibold text-[var(--admin-ink)]">
                  {staff.fullName}
                </span>
                .
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
