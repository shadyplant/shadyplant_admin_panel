"use client";

import { MoreHorizontal } from "lucide-react";
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
import type { AdminCoupon, ApiResponse } from "@/lib/admin-api";
import { formatAdminCurrency, formatAdminDate } from "@/lib/admin-utils";

type CouponType = "adjust" | "discount";

export default function CouponsPage() {
  const { authorizedRequest } = useAdminAuth();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [form, setForm] = useState({
    type: "adjust" as CouponType,
    code: "",
    adjustAmount: "500",
    discountPercent: "10",
    expiresAt: "",
    notes: "",
  });

  async function loadCoupons() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ coupons: AdminCoupon[] }>>(
          "/admin/coupons",
        );
      setCoupons(response.data.coupons);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load coupons.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncCoupons() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ coupons: AdminCoupon[] }>>(
            "/admin/coupons",
          );

        if (!cancelled) {
          setCoupons(response.data.coupons);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load coupons.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncCoupons();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const filteredCoupons = coupons.filter((coupon) => {
    const matchesQuery = [
      coupon.code,
      coupon.type,
      coupon.status,
      coupon.notes,
      coupon.createdByStaff?.email,
      coupon.createdByStaff?.fullName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" || coupon.effectiveStatus === statusFilter;

    return matchesQuery && matchesStatus;
  });

  const summary = filteredCoupons.reduce(
    (accumulator, coupon) => {
      accumulator.total += 1;
      if (coupon.effectiveStatus === "active") {
        accumulator.active += 1;
      } else if (coupon.effectiveStatus === "inactive") {
        accumulator.inactive += 1;
      } else if (coupon.effectiveStatus === "used") {
        accumulator.used += 1;
      } else if (coupon.effectiveStatus === "expired") {
        accumulator.expired += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      active: 0,
      inactive: 0,
      used: 0,
      expired: 0,
    },
  );

  async function handleCreateCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ coupon: AdminCoupon }>>(
          "/admin/coupons",
          {
            method: "POST",
            body: JSON.stringify({
              type: form.type,
              code: form.code.trim(),
              adjustAmount:
                form.type === "adjust" ? Number(form.adjustAmount || 0) : undefined,
              discountPercent:
                form.type === "discount"
                  ? Number(form.discountPercent || 0)
                  : undefined,
              expiresAt: form.expiresAt
                ? new Date(form.expiresAt).toISOString()
                : undefined,
              notes: form.notes.trim(),
            }),
          },
        );

      setCoupons((currentCoupons) => [response.data.coupon, ...currentCoupons]);
      setForm((currentForm) => ({
        ...currentForm,
        code: "",
        notes: "",
      }));
      setFeedback({
        type: "success",
        text: `Coupon ${response.data.coupon.code} created successfully.`,
      });
    } catch (nextError) {
      setFeedback({
        type: "error",
        text:
          nextError instanceof Error
            ? nextError.message
            : "Unable to create coupon.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleCoupon(coupon: AdminCoupon) {
    setActioningId(coupon.id);
    setOpenActionMenuId(null);
    setFeedback(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ coupon: AdminCoupon }>>(
          `/admin/coupons/${coupon.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: coupon.effectiveStatus === "active" ? "inactive" : "active",
            }),
          },
        );

      setCoupons((currentCoupons) =>
        currentCoupons.map((entry) =>
          entry.id === coupon.id ? response.data.coupon : entry,
        ),
      );
      setFeedback({
        type: "success",
        text: `Coupon ${response.data.coupon.code} is now ${response.data.coupon.effectiveStatus}.`,
      });
    } catch (nextError) {
      setFeedback({
        type: "error",
        text:
          nextError instanceof Error
            ? nextError.message
            : "Unable to update coupon.",
      });
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeleteCoupon(coupon: AdminCoupon) {
    const shouldDelete = window.confirm(`Delete coupon ${coupon.code}?`);

    if (!shouldDelete) {
      return;
    }

    setActioningId(coupon.id);
    setOpenActionMenuId(null);
    setFeedback(null);

    try {
      await authorizedRequest(`/admin/coupons/${coupon.id}`, {
        method: "DELETE",
      });

      setCoupons((currentCoupons) =>
        currentCoupons.filter((entry) => entry.id !== coupon.id),
      );
      setFeedback({
        type: "success",
        text: `Coupon ${coupon.code} deleted successfully.`,
      });
    } catch (nextError) {
      setFeedback({
        type: "error",
        text:
          nextError instanceof Error
            ? nextError.message
            : "Unable to delete coupon.",
      });
    } finally {
      setActioningId(null);
    }
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((currentCode) => (currentCode === code ? null : currentCode));
      }, 1200);
      setFeedback({
        type: "success",
        text: `Coupon code ${code} copied.`,
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Unable to copy coupon code.",
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedCoupons = filteredCoupons.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading coupons..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadCoupons} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Pricing Control"
        title="Coupon Generator"
        description=""
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total coupons", value: summary.total },
          { label: "Active", value: summary.active },
          { label: "Inactive", value: summary.inactive },
          { label: "Used", value: summary.used },
          { label: "Expired", value: summary.expired },
        ].map((metric) => (
          <AdminPanel key={metric.label} className="p-4 border border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-medium tracking-[-0.05em] text-gray-600">
              {metric.value}
            </p>
          </AdminPanel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <AdminPanel className="shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-gray-600">
              Generate coupon
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Every coupon created here is one-time-use by default.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleCreateCoupon}>
            <label className="block">
              <span className="text-sm font-semibold text-gray-600">
                Coupon type
              </span>
              <div className="mt-2">
                <AdminSelect
                  value={form.type}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      type: event.target.value as CouponType,
                    }))
                  }
                >
                  <option value="adjust">AdjustCoupon</option>
                  <option value="discount">DiscountCoupon</option>
                </AdminSelect>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-600">
                Coupon code
              </span>
              <div className="mt-2">
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  className={inputClassName()}
                  placeholder="Leave blank to auto-generate"
                />
              </div>
            </label>

            {form.type === "adjust" ? (
              <label className="block">
                <span className="text-sm font-semibold text-gray-600">
                  Adjust amount
                </span>
                <div className="mt-2">
                  <input
                    type="number"
                    min="1"
                    value={form.adjustAmount}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        adjustAmount: event.target.value,
                      }))
                    }
                    className={inputClassName()}
                    placeholder="Enter fixed amount"
                  />
                </div>
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-semibold text-gray-600">
                  Discount percent
                </span>
                <div className="mt-2">
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={form.discountPercent}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        discountPercent: event.target.value,
                      }))
                    }
                    className={inputClassName()}
                    placeholder="Enter percent"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-gray-600">
                Expiry date
              </span>
              <div className="mt-2">
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      expiresAt: event.target.value,
                    }))
                  }
                  className={inputClassName()}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-600">
                Internal note
              </span>
              <div className="mt-2">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      notes: event.target.value,
                    }))
                  }
                  className={textareaClassName()}
                  placeholder="Optional note for campaign or staff context."
                />
              </div>
            </label>

        

           <div className="mt-4 flex items-center justify-center gap-3">
             <AdminActionButton type="submit" disabled={submitting}>
              {submitting ? "Generating..." : "Generate one-time coupon"}
            </AdminActionButton>
           </div>
          </form>
        </AdminPanel>

        <div className="space-y-4 shadow-[0_30px_90px_rgba(0,0,0,0.05)]">
          <AdminPanel>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <AdminTextInput
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by coupon code, type, note, or creator"
                  className="max-w-xl"
                />
                <AdminSelect
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="md:w-[220px]"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="used">Used</option>
                  <option value="expired">Expired</option>
                </AdminSelect>
              </div>
              <p className="text-sm font-semibold text-gray-500">
                {coupons.length} coupon records
              </p>
            </div>
          </AdminPanel>

          {feedback ? (
            <div
              className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${
                feedback.type === "error"
                  ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
                  : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          {!filteredCoupons.length ? (
            <AdminEmptyCard
              title="No coupons found"
              description="Generate your first one-time coupon or adjust the filters."
            />
          ) : (
            <div className="space-y-4">
              {paginatedCoupons.map((coupon) => (
                <AdminPanel key={coupon.id}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-[-0.04em] text-gray-600">
                          {coupon.code}
                        </h2>
                        <AdminStatusPill status={coupon.effectiveStatus} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                            Type
                          </p>
                          <p className="mt-2 text-sm font-semibold text-gray-600">
                            {coupon.type === "adjust" ? "AdjustCoupon" : "DiscountCoupon"}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                            Benefit
                          </p>
                          <p className="mt-2 text-sm font-semibold text-gray-600">
                            {coupon.type === "adjust"
                              ? formatAdminCurrency(coupon.adjustAmount)
                              : `${coupon.discountPercent}%`}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                            Usage
                          </p>
                          <p className="mt-2 text-sm font-semibold text-gray-600">
                            {coupon.totalUsesRedeemed}/{coupon.totalUsesAllowed} used
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                            Expires
                          </p>
                          <p className="mt-2 text-sm font-semibold text-gray-600">
                            {coupon.expiresAt ? formatAdminDate(coupon.expiresAt) : "No expiry"}
                          </p>
                        </div>
                      </div>
                      {coupon.notes ? (
                        <p className="text-sm text-gray-600">
                          Note: {coupon.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex min-w-[320px] flex-col gap-3">
                      <p className="text-xs text-gray-600">
                        Created {formatAdminDate(coupon.createdAt)}
                        {coupon.createdByStaff?.email
                          ? ` by ${coupon.createdByStaff.email}`
                          : ""}
                      </p>
                      <div className="flex items-center gap-3">
                        <AdminActionButton
                          type="button"
                          tone="secondary"
                          className="flex-1"
                          onClick={() => void handleCopyCode(coupon.code)}
                        >
                          {copiedCode === coupon.code ? "Copied" : "Copy code"}
                        </AdminActionButton>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionMenuId((currentId) =>
                                currentId === coupon.id ? null : coupon.id,
                              )
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--admin-line-strong)] bg-white text-gray-600 transition hover:bg-[var(--admin-chip)]"
                            aria-label="Open coupon actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {openActionMenuId === coupon.id ? (
                            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[180px] rounded-[1rem] border border-[var(--admin-line)] bg-white p-2 shadow-[0_16px_40px_rgba(18,43,16,0.12)]">
                              {coupon.effectiveStatus === "active" ||
                              coupon.effectiveStatus === "inactive" ? (
                                <button
                                  type="button"
                                  className={`flex w-full rounded-[0.8rem] px-3 py-2 text-left text-sm font-semibold transition ${
                                    coupon.effectiveStatus === "active"
                                      ? "text-[#9d3b2d] hover:bg-[#fff4f2]"
                                      : "text-[var(--admin-accent)] hover:bg-[var(--admin-accent-soft)]"
                                  }`}
                                  disabled={actioningId === coupon.id}
                                  onClick={() => void handleToggleCoupon(coupon)}
                                >
                                  {actioningId === coupon.id
                                    ? "Saving..."
                                    : coupon.effectiveStatus === "active"
                                      ? "Deactivate"
                                      : "Activate"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex w-full rounded-[0.8rem] px-3 py-2 text-left text-sm font-semibold text-[#9d3b2d] transition hover:bg-[#fff4f2]"
                                disabled={actioningId === coupon.id}
                                onClick={() => void handleDeleteCoupon(coupon)}
                              >
                                {actioningId === coupon.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </AdminPanel>
              ))}

              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={filteredCoupons.length}
                pageSize={pageSize}
                label="coupons"
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
