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
  AdminMetricCard,
  AdminPanel,
  AdminPill,
  AdminSelect,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type {
  AdminTransaction,
  AdminTransactionSummary,
  ApiResponse,
} from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatAdminDate,
} from "@/lib/admin-utils";

type TransactionsPayload = {
  transactions: AdminTransaction[];
  summary: AdminTransactionSummary;
};

const EMPTY_SUMMARY: AdminTransactionSummary = {
  totalRecords: 0,
  totalGrossAmount: 0,
  totalReceivedAmount: 0,
  totalOutstandingAmount: 0,
  failedAmount: 0,
  cashOnDeliveryAmount: 0,
  onlineReceivedAmount: 0,
  onlinePendingAmount: 0,
};

export default function TransactionsPage() {
  const { authorizedRequest } = useAdminAuth();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [summary, setSummary] = useState<AdminTransactionSummary>(EMPTY_SUMMARY);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<TransactionsPayload>>(
        "/admin/transactions",
      );
      setTransactions(response.data.transactions);
      setSummary(response.data.summary || EMPTY_SUMMARY);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load transactions.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncTransactions() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<TransactionsPayload>>(
            "/admin/transactions",
          );

        if (!cancelled) {
          setTransactions(response.data.transactions);
          setSummary(response.data.summary || EMPTY_SUMMARY);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load transactions.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncTransactions();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const statusOptions = [
    ...new Set(
      transactions
        .map((transaction) => String(transaction.paymentStatus || "").trim())
        .filter(Boolean),
    ),
  ];
  const methodOptions = [
    ...new Set(
      transactions
        .map((transaction) => String(transaction.paymentMethod || "").trim())
        .filter(Boolean),
    ),
  ];
  const filteredTransactions = [...transactions]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .filter((transaction) => {
      const matchesQuery = [
        transaction.orderNumber,
        transaction.trackingCode,
        transaction.paymentAttemptId,
        transaction.customerName,
        transaction.customerEmail,
        transaction.customerPhone,
        transaction.gatewayOrderId,
        transaction.gatewayPaymentId,
        transaction.paymentStatus,
        transaction.paymentMethod,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "all" || transaction.paymentStatus === statusFilter;
      const matchesMethod =
        methodFilter === "all" || transaction.paymentMethod === methodFilter;

      return matchesQuery && matchesStatus && matchesMethod;
    });
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading transactions..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadTransactions} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Transactions"
        description="Monitor order payments, money received, pending collection, and incomplete checkout attempts from a single commerce ledger."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Gross Monitored"
          value={formatAdminCurrency(summary.totalGrossAmount)}
          meta={`${summary.totalRecords} payment records tracked across orders and checkout attempts`}
        />
        <AdminMetricCard
          label="Money Received"
          value={formatAdminCurrency(summary.totalReceivedAmount)}
          meta={`${formatAdminCurrency(summary.onlineReceivedAmount)} collected through online payments`}
        />
        <AdminMetricCard
          label="Outstanding"
          value={formatAdminCurrency(summary.totalOutstandingAmount)}
          meta={`${formatAdminCurrency(summary.cashOnDeliveryAmount)} still expected on cash on delivery`}
        />
        <AdminMetricCard
          label="At Risk"
          value={formatAdminCurrency(summary.failedAmount)}
          meta={`${formatAdminCurrency(summary.onlinePendingAmount)} still pending through online checkout`}
        />
      </div>

      <AdminPanel>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 md:grid-cols-3 xl:min-w-[880px] xl:flex-1">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by customer, order, payment attempt, or gateway ID"
            />
            <AdminSelect
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All payment states</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={methodFilter}
              onChange={(event) => {
                setMethodFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All payment methods</option>
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method.replaceAll("_", " ")}
                </option>
              ))}
            </AdminSelect>
          </div>
          <p className="text-sm font-semibold text-[var(--admin-muted)]">
            {transactions.length} transaction records
          </p>
        </div>
      </AdminPanel>

      {!filteredTransactions.length ? (
        <AdminEmptyCard
          title="No transactions found"
          description="Try another filter or wait for new checkouts and order payments to appear here."
        />
      ) : (
        <div className="space-y-4">
          {paginatedTransactions.map((transaction) => {
            const title =
              transaction.orderNumber ||
              transaction.paymentAttemptId ||
              "Unlinked transaction";
            const secondaryStatus =
              transaction.checkoutStatus &&
              transaction.checkoutStatus !== transaction.paymentStatus
                ? transaction.checkoutStatus
                : "";

            return (
              <div
                key={transaction.id}
                className="rounded-[1.6rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_18px_40px_rgba(18,43,16,0.05)]"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminPill>{transaction.sourceLabel}</AdminPill>
                      {transaction.currentStatus ? (
                        <AdminPill>{transaction.currentStatus.replaceAll("_", " ")}</AdminPill>
                      ) : null}
                    </div>

                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      {title}
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                      {transaction.customerName}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                      {transaction.customerEmail || "No email"} |{" "}
                      {transaction.customerPhone || "No phone"} |{" "}
                      {formatAdminDate(transaction.createdAt)}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <AdminStatusPill status={transaction.paymentStatus} />
                      {secondaryStatus ? (
                        <AdminStatusPill status={secondaryStatus} />
                      ) : null}
                      <AdminPill>
                        {transaction.paymentMethodLabel ||
                          transaction.paymentMethod.replaceAll("_", " ")}
                      </AdminPill>
                    </div>
                  </div>

                  <div className="min-w-[220px] rounded-[1.3rem] bg-[var(--admin-chip)] px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Transaction amount
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[var(--admin-accent)]">
                      {formatAdminCurrency(transaction.amount)}
                    </p>
                    <p className="mt-2 text-sm text-[var(--admin-muted)]">
                      {transaction.isMoneyReceived
                        ? `Received ${formatAdminCurrency(transaction.receivedAmount)}`
                        : `Outstanding ${formatAdminCurrency(transaction.outstandingAmount)}`}
                    </p>
                    {transaction.orderId ? (
                      <Link
                        href={`/orders/${transaction.orderId}`}
                        className="mt-4 inline-flex text-sm font-semibold text-[var(--admin-accent)]"
                      >
                        Open linked order
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                      Gateway order ID
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                      {transaction.gatewayOrderId || "Not available"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                      Gateway payment ID
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                      {transaction.gatewayPaymentId || "Not available"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                      Processed at
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                      {transaction.processedAt
                        ? formatAdminDate(transaction.processedAt)
                        : "Not processed yet"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                      Provider
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                      {transaction.provider || "Not available"}
                    </p>
                  </div>
                </div>

                {transaction.failureReason ? (
                  <div className="mt-4 rounded-[1rem] border border-[#f2d1cb] bg-[#fff5f2] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a15545]">
                      Failure reason
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#8a483b]">
                      {transaction.failureReason}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}

          <AdminPagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredTransactions.length}
            pageSize={pageSize}
            label="transactions"
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
