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
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminCustomer, ApiResponse } from "@/lib/admin-api";
import { formatCompactDate } from "@/lib/admin-utils";

export default function CustomersPage() {
  const { authorizedRequest } = useAdminAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      return matchesQuery && matchesVerification;
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
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Customer Base"
        title="Customers"
        description="Review customer profiles, verify contact details, and maintain delivery or billing metadata used by the storefront."
      />

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
          </div>
          <p className="text-sm font-semibold text-[var(--admin-muted)]">
            {customers.length} customers
          </p>
        </div>
      </AdminPanel>

      {!filteredCustomers.length ? (
        <AdminEmptyCard
          title="No customers found"
          description="Try another query. Customer records will appear here as users sign up or place orders."
        />
      ) : (
        <div className="space-y-4">
          {paginatedCustomers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="block rounded-[1.6rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_18px_40px_rgba(18,43,16,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(18,43,16,0.07)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                    {customer.fullName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                    {customer.email || "No email"} | {customer.phoneNumber || "No phone"} | Joined{" "}
                    {formatCompactDate(customer.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <AdminStatusPill
                    status={customer.isVerified ? "verified" : "unverified"}
                  />
                  <span className="text-sm font-semibold text-[var(--admin-muted)]">
                    {customer.authProvider}
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
    </div>
  );
}
