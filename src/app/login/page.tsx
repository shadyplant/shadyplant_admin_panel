"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import Image from "next/image";
import {
  adminRequest,
  type AdminStaff,
  type ApiResponse,
} from "@/lib/admin-api";

type SetupStatusResponse = ApiResponse<{ isSetupComplete: boolean }>;
type SetupResponse = ApiResponse<{
  staff: AdminStaff;
  expiresIn: string;
}>;

export default function LoginPage() {
  const router = useRouter();
  const { login, setSession, hydrated, isAuthenticated, staff } =
    useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState(
    "Grass Green Nursery",
  );
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
        const response = await adminRequest<SetupResponse>(
          "/admin/auth/setup",
          {
            method: "POST",
            body: JSON.stringify({
              fullName: fullName.trim(),
              email: email.trim(),
              password,
              organizationName: organizationName.trim(),
            }),
          },
        );

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
    <div className="flex min-h-screen bg-[#20795820] items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-md border border-white/60 bg-white shadow-[0_40px_120px_rgba(14,31,13,0.07)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden bg-gray-100">
          <Image
            src="https://wpcdn.us-midwest-1.vip.tn-cloud.net/www.rimonthly.com/content/uploads/2022/06/x/j/ne22ec54pla-scaled.jpg"
            alt="Banner"
            fill
            priority
            className="object-cover"
          />
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto w-full max-w-md">
            <h2 className="mt-3 text-3xl text-gray-800">
              {setupRequired
                ? "Create the first admin owner"
                : "Login to ShadyPlant Console"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-800">
              {setupRequired
                ? "No staff account exists yet. Create the first owner account for the organization"
                : "Use your admin or team organization account."}
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
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      placeholder="ShadyPlant"
                      className="mt-2 w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none transition placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]"
                      required
                    />
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Staff email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@grassgreen.in"
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-[#8a9b88] focus:border-gray-600 "
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your staff password"
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-[#8a9b88] focus:border-gray-600 "
                  required
                />
              </label>

              {error ? (
                <div className="rounded-md border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-medium text-[#a73d31]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || setupLoading}
                className="w-full rounded-full bg-[#207958] px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setupLoading
                  ? "Checking setup..."
                  : isSubmitting
                    ? setupRequired
                      ? "Creating owner..."
                      : "Signing in..."
                    : setupRequired
                      ? "Create admin owner"
                      : "Log in"}
              </button>
            </form>

            {hydrated && isAuthenticated && staff ? (
              <div className="mt-6 rounded-md bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
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
