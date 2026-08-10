"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminEmptyCard,
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminCustomer, ApiResponse } from "@/lib/admin-api";
import { formatCompactDate } from "@/lib/admin-utils";

type CreateCustomerFormState = {
  fullName: string;
  email: string;
  password: string;
  isVip: boolean;
  customerCategory: "normal" | "nursery_owner" | "garden_contractor";
};

type PaymentAccessFormState = {
  cashOnDelivery: boolean;
  onlinePayment: boolean;
  emi: boolean;
};

export default function CustomersPage() {
  const { authorizedRequest } = useAdminAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [createForm, setCreateForm] = useState<CreateCustomerFormState>({
    fullName: "",
    email: "",
    password: "",
    isVip: false,
    customerCategory: "normal",
  });
  const [query, setQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [paymentAccessCustomer, setPaymentAccessCustomer] =
    useState<AdminCustomer | null>(null);
  const [paymentAccessForm, setPaymentAccessForm] =
    useState<PaymentAccessFormState | null>(null);
  const [paymentAccessError, setPaymentAccessError] = useState<string | null>(null);
  const [paymentAccessSuccess, setPaymentAccessSuccess] = useState<string | null>(null);
  const [isSavingPaymentAccess, setIsSavingPaymentAccess] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ customers: AdminCustomer[] }>>(
          "/admin/customers",
        );
      setCustomers(response.data.customers);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncCustomers() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ customers: AdminCustomer[] }>>(
            "/admin/customers",
          );

        if (!cancelled) {
          setCustomers(response.data.customers);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load customers.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncCustomers();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          "/admin/customers",
          {
            method: "POST",
            body: JSON.stringify({
              fullName: createForm.fullName.trim(),
              email: createForm.email.trim(),
              password: createForm.password,
              isVip: createForm.isVip,
              customerCategory: createForm.customerCategory,
            }),
          },
        );

      setCustomers((currentCustomers) => [
        response.data.customer,
        ...currentCustomers.filter(
          (customer) => customer.id !== response.data.customer.id,
        ),
      ]);
      setCreateForm({
        fullName: "",
        email: "",
        password: "",
        isVip: false,
        customerCategory: "normal",
      });
      setCreateSuccess("Customer account created successfully.");
      setCurrentPage(1);
    } catch (nextError) {
      setCreateError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create customer account.",
      );
    } finally {
      setCreating(false);
    }
  }

  function openPaymentAccessModal(customer: AdminCustomer) {
    setPaymentAccessCustomer(customer);
    setPaymentAccessForm({
      cashOnDelivery: Boolean(customer.paymentAccess.cashOnDelivery),
      onlinePayment: Boolean(customer.paymentAccess.onlinePayment),
      emi: Boolean(customer.paymentAccess.emi),
    });
    setPaymentAccessError(null);
    setPaymentAccessSuccess(null);
  }

  function closePaymentAccessModal() {
    if (isSavingPaymentAccess) {
      return;
    }

    setPaymentAccessCustomer(null);
    setPaymentAccessForm(null);
    setPaymentAccessError(null);
    setPaymentAccessSuccess(null);
  }

  async function handleSavePaymentAccess() {
    if (!paymentAccessCustomer || !paymentAccessForm) {
      return;
    }

    setIsSavingPaymentAccess(true);
    setPaymentAccessError(null);
    setPaymentAccessSuccess(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          `/admin/customers/${paymentAccessCustomer.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              paymentAccess: paymentAccessForm,
            }),
          },
        );

      setCustomers((currentCustomers) =>
        currentCustomers.map((customer) =>
          customer.id === response.data.customer.id ? response.data.customer : customer,
        ),
      );
      setPaymentAccessCustomer(response.data.customer);
      setPaymentAccessForm({
        cashOnDelivery: response.data.customer.paymentAccess.cashOnDelivery,
        onlinePayment: response.data.customer.paymentAccess.onlinePayment,
        emi: response.data.customer.paymentAccess.emi,
      });
      setPaymentAccessSuccess("Customer payment access updated successfully.");
    } catch (nextError) {
      setPaymentAccessError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update customer payment access.",
      );
    } finally {
      setIsSavingPaymentAccess(false);
    }
  }

  function handleExportFilteredCustomers() {
    const rows = filteredCustomers.map((customer) => ({
      fullName: customer.fullName,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      vip: customer.isVip ? "Yes" : "No",
      customerCategory: customer.customerCategory,
      accountStatus: customer.accountStatus,
      bannedUntil: customer.bannedUntil || "",
      createdAt: customer.createdAt,
    }));

    const headers = Object.keys(rows[0] || {
      fullName: "",
      email: "",
      phoneNumber: "",
      vip: "",
      customerCategory: "",
      accountStatus: "",
      bannedUntil: "",
      createdAt: "",
    });
    const escapeCsvValue = (value: unknown) =>
      `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${categoryFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredCustomers = [...customers]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .filter((customer) => {
      const matchesQuery = [
        customer.fullName,
        customer.email,
        customer.phoneNumber,
        customer.authProvider,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const verificationState = customer.isVerified ? "verified" : "unverified";
      const matchesVerification =
        verificationFilter === "all" || verificationState === verificationFilter;
      const matchesCategory =
        categoryFilter === "all" || customer.customerCategory === categoryFilter;

      return matchesQuery && matchesVerification && matchesCategory;
    });
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading customers..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadCustomers} />;
  }

  return (
    <div className="space-y-1">
      <AdminPageHeader
        eyebrow="Customer Base"
        title="Customers"
        description="Review customer profiles, verify contact details, and maintain delivery or billing metadata used by the storefront."
      />

      <AdminPanel>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleCreateCustomer}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px_160px_auto] lg:items-end">
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
                Customer name
              </p>
              <AdminTextInput
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({
                    ...currentForm,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Enter full name"
              />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
                Email
              </p>
              <AdminTextInput
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({
                    ...currentForm,
                    email: event.target.value,
                  }))
                }
                placeholder="customer@example.com"
              />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
                Password
              </p>
              <AdminTextInput
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                placeholder="Create login password"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
                Category
              </p>
              <AdminSelect
                value={createForm.customerCategory}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({
                    ...currentForm,
                    customerCategory: event.target.value as CreateCustomerFormState["customerCategory"],
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="nursery_owner">Nursery owner</option>
                <option value="garden_contractor">Garden contractor</option>
              </AdminSelect>
            </div>
            <label className="inline-flex items-center gap-3 rounded-sm border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={createForm.isVip}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({
                    ...currentForm,
                    isVip: event.target.checked,
                  }))
                }
              />
              Mark as VIP
            </label>
            <AdminActionButton type="submit" tone="primary" disabled={creating}>
              {creating ? "Creating..." : "Create customer"}
            </AdminActionButton>
          </div>
   
          {createError ? (
            <div className="rounded-[1rem] border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-medium text-[#a73d31]">
              {createError}
            </div>
          ) : null}
          {createSuccess ? (
            <div className="rounded-[1rem] border border-[#cfe2c8] bg-[#f4fbf1] px-4 py-3 text-sm font-medium text-[#256233]">
              {createSuccess}
            </div>
          ) : null}
        </form>
      </AdminPanel>

      <AdminPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, phone, or auth provider"
              className="max-w-xl"
            />
            <AdminSelect
              value={verificationFilter}
              onChange={(event) => {
                setVerificationFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All customers</option>
              <option value="verified">Verified only</option>
              <option value="unverified">Unverified only</option>
            </AdminSelect>
            <AdminSelect
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All categories</option>
              <option value="normal">Normal</option>
              <option value="nursery_owner">Nursery owner</option>
              <option value="garden_contractor">Garden contractor</option>
            </AdminSelect>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-[var(--admin-muted)]">
              {customers.length} customers
            </p>
            <AdminActionButton
              type="button"
              tone="secondary"
              onClick={handleExportFilteredCustomers}
              disabled={!filteredCustomers.length}
            >
              Export filtered
            </AdminActionButton>
          </div>
        </div>
      </AdminPanel>

      {!filteredCustomers.length ? (
        <AdminEmptyCard
          title="No customers found"
          description="Try another query. Customer records will appear here as users sign up or place orders."
        />
      ) : (
        <div className="space-y-4">
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Email
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Category
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Payments
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-gray-300 align-top transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                              {customer.fullName}
                            </p>
                            {customer.isVip ? (
                              <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b5b08]">
                                VIP
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {customer.isVerified ? "Verified" : "Unverified"} account
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[220px] text-sm text-gray-700">
                          {customer.email || "No email"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[140px] text-sm text-gray-700">
                          {customer.phoneNumber || "No phone"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[150px] text-sm font-semibold capitalize text-gray-500">
                          {customer.customerCategory.replaceAll("_", " ")}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[220px] flex-wrap items-center gap-2">
                          <AdminStatusPill status={customer.accountStatus} />
                          <span className="text-sm text-gray-500">
                            {customer.authProvider}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[220px] flex-wrap gap-2">
                          {customer.paymentAccess.cashOnDelivery ? (
                            <span className="inline-flex items-center rounded-full bg-[#eff7ea] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2d6a31]">
                              COD
                            </span>
                          ) : null}
                          {customer.paymentAccess.onlinePayment ? (
                            <span className="inline-flex items-center rounded-full bg-[#eef4ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3257a8]">
                              Online
                            </span>
                          ) : null}
                          {customer.paymentAccess.emi ? (
                            <span className="inline-flex items-center rounded-full bg-[#fff3df] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#946100]">
                              EMI
                            </span>
                          ) : null}
                          {!customer.paymentAccess.cashOnDelivery &&
                          !customer.paymentAccess.onlinePayment &&
                          !customer.paymentAccess.emi ? (
                            <span className="text-sm text-[var(--admin-muted)]">
                              No payment methods
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[120px] text-sm text-gray-700">
                          {formatCompactDate(customer.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[320px] flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPaymentAccessModal(customer)}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                          >
                            Payment access
                          </button>
                          <Link
                            href={`/customers/${customer.id}#cart`}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] bg-white px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                          >
                            Assign cart
                          </Link>
                          <Link
                            href={`/customers/${customer.id}`}
                            className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>
          <AdminPagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredCustomers.length}
            pageSize={pageSize}
            label="customers"
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {paymentAccessCustomer && paymentAccessForm ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,24,12,0.28)] p-4">
          <div className="w-full max-w-[560px] rounded-[1.2rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_20px_60px_rgba(18,43,16,0.18)]">
            <div className="border-b border-[var(--admin-line)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                Payment Access
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                {paymentAccessCustomer.fullName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                Control which payment methods this customer can see and use on ecommerce.
                EMI stays hidden by default until you enable it here.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--admin-line)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={paymentAccessForm.cashOnDelivery}
                  onChange={(event) =>
                    setPaymentAccessForm((currentForm) =>
                      currentForm
                        ? {
                            ...currentForm,
                            cashOnDelivery: event.target.checked,
                          }
                        : currentForm,
                    )
                  }
                  className="mt-1 h-4 w-4 accent-[var(--admin-accent)]"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-ink)]">
                    Cash on delivery
                  </p>
                  <p className="text-sm text-[var(--admin-muted)]">
                    Show COD as an available payment method for this customer.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--admin-line)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={paymentAccessForm.onlinePayment}
                  onChange={(event) =>
                    setPaymentAccessForm((currentForm) =>
                      currentForm
                        ? {
                            ...currentForm,
                            onlinePayment: event.target.checked,
                          }
                        : currentForm,
                    )
                  }
                  className="mt-1 h-4 w-4 accent-[var(--admin-accent)]"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-ink)]">
                    Online payment
                  </p>
                  <p className="text-sm text-[var(--admin-muted)]">
                    Allow standard gateway payment for this customer account.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--admin-line)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={paymentAccessForm.emi}
                  onChange={(event) =>
                    setPaymentAccessForm((currentForm) =>
                      currentForm
                        ? {
                            ...currentForm,
                            emi: event.target.checked,
                          }
                        : currentForm,
                    )
                  }
                  className="mt-1 h-4 w-4 accent-[var(--admin-accent)]"
                />
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-ink)]">
                    EMI access
                  </p>
                  <p className="text-sm text-[var(--admin-muted)]">
                    Makes EMI visible on the web for this customer. Leave off for everyone else.
                  </p>
                </div>
              </label>
            </div>

            {paymentAccessError ? (
              <div className="mt-4 rounded-[1rem] border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-medium text-[#a73d31]">
                {paymentAccessError}
              </div>
            ) : null}
            {paymentAccessSuccess ? (
              <div className="mt-4 rounded-[1rem] border border-[#cfe2c8] bg-[#f4fbf1] px-4 py-3 text-sm font-medium text-[#256233]">
                {paymentAccessSuccess}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={closePaymentAccessModal}
                disabled={isSavingPaymentAccess}
              >
                Close
              </AdminActionButton>
              <AdminActionButton
                type="button"
                tone="primary"
                onClick={() => void handleSavePaymentAccess()}
                disabled={isSavingPaymentAccess}
              >
                {isSavingPaymentAccess ? "Saving..." : "Save payment access"}
              </AdminActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
