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
  AdminPill,
  AdminStatusPill,
  AdminSelect,
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

function formatTransactionLabel(value: string | null | undefined, fallback: string) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.replaceAll("_", " ");
}

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
        {[
          {
            label: "Gross Monitored",
            value: formatAdminCurrency(summary.totalGrossAmount),
            meta: `${summary.totalRecords} payment records tracked across orders and checkout attempts`,
          },
          {
            label: "Money Received",
            value: formatAdminCurrency(summary.totalReceivedAmount),
            meta: `${formatAdminCurrency(summary.onlineReceivedAmount)} collected through online payments`,
          },
          {
            label: "Outstanding",
            value: formatAdminCurrency(summary.totalOutstandingAmount),
            meta: `${formatAdminCurrency(summary.cashOnDeliveryAmount)} still expected on cash on delivery`,
          },
          {
            label: "At Risk",
            value: formatAdminCurrency(summary.failedAmount),
            meta: `${formatAdminCurrency(summary.onlinePendingAmount)} still pending through online checkout`,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4"
          >
            <p className="text-xs font-semibold uppercase text-[var(--admin-muted)]">
              {metric.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-[var(--admin-ink)]">
              {metric.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
              {metric.meta}
            </p>
          </div>
        ))}
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
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto admin-scrollbar-thin">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--admin-line)] bg-[#f8faf6] text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Transaction
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Gateway
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Processed
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--admin-muted)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
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
                      <tr
                        key={transaction.id}
                        className="border-b border-[var(--admin-line)] align-top transition hover:bg-[#fbfdf8]"
                      >
                        <td className="px-4 py-4">
                          <div className="min-w-[220px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <AdminPill>{transaction.sourceLabel}</AdminPill>
                              {transaction.currentStatus ? (
                                <AdminPill>
                                  {formatTransactionLabel(
                                    transaction.currentStatus,
                                    "Unknown",
                                  )}
                                </AdminPill>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">
                              {title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Tracking {transaction.trackingCode || "Not available"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Created {formatAdminDate(transaction.createdAt)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[220px]">
                            <p className="text-sm font-semibold text-[var(--admin-ink)]">
                              {transaction.customerName || "No customer name"}
                            </p>
                            <p className="mt-1 text-sm text-[var(--admin-muted)]">
                              {transaction.customerPhone || "No phone"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              {transaction.customerEmail || "No email"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[170px]">
                            <p className="text-sm font-semibold text-[var(--admin-accent)]">
                              {formatAdminCurrency(transaction.amount)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Received{" "}
                              {formatAdminCurrency(transaction.receivedAmount)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Outstanding{" "}
                              {formatAdminCurrency(transaction.outstandingAmount)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[230px] flex-col items-start gap-2">
                            <AdminStatusPill status={transaction.paymentStatus} />
                            {secondaryStatus ? (
                              <AdminStatusPill status={secondaryStatus} />
                            ) : null}
                            <AdminPill>
                              {transaction.paymentMethodLabel ||
                                formatTransactionLabel(
                                  transaction.paymentMethod,
                                  "Unknown method",
                                )}
                            </AdminPill>
                            <span className="text-xs text-[var(--admin-muted)]">
                              Provider: {transaction.provider || "Not available"}
                            </span>
                            {transaction.failureReason ? (
                              <span className="text-xs text-[#9d3b2d]">
                                Failed: {transaction.failureReason}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[240px]">
                            <p className="text-sm font-semibold text-[var(--admin-ink)]">
                              {transaction.gatewayOrderId || "No gateway order ID"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Payment ID:{" "}
                              {transaction.gatewayPaymentId || "Not available"}
                            </p>
                            {transaction.lastWebhookEvent ? (
                              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                                Webhook:{" "}
                                {formatTransactionLabel(
                                  transaction.lastWebhookEvent,
                                  "Unknown",
                                )}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[160px]">
                            <p className="text-sm font-semibold text-[var(--admin-ink)]">
                              {transaction.processedAt
                                ? formatAdminDate(transaction.processedAt)
                                : "Not processed yet"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              {transaction.isMoneyReceived
                                ? "Funds captured"
                                : "Awaiting collection"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="min-w-[140px]">
                            {transaction.orderId ? (
                              <Link
                                href={`/orders/${transaction.orderId}`}
                                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                              >
                                Open order
                              </Link>
                            ) : (
                              <span className="text-xs text-[var(--admin-muted)]">
                                No linked order
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminPanel>

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
