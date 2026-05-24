"use client";

import { renderToStaticMarkup } from "react-dom/server";
import { useEffect, useState, type CSSProperties } from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminMetricCard,
  AdminPanel,
  AdminSelect,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type {
  AdminSalesReportPayload,
  ApiResponse,
} from "@/lib/admin-api";

type DatePreset = "all" | "today" | "yesterday" | "last_7_days" | "last_30_days" | "custom";

export interface SaleReportItem {
  sNo: number;
  itemName: string;
  hsnSac?: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
  taxablePricePerUnit?: number;
  finalRate: number;
  discount?: number;
  discountPercent?: string;
  amount: number;
}

export interface SaleReportTransaction {
  id?: string;
  createdAt?: string;
  date: string;
  orderNo?: string | number;
  invoiceNo: string | number;
  partyName: string;
  gstin?: string;
  partyPhone?: string;
  transactionType: string;
  total: number;
  paymentType?: string;
  received: number;
  balanceDue: number;
  dueDate?: string;
  status: "Paid" | "Overdue" | string;
  overdueDays?: number;
  items: SaleReportItem[];
  discount?: number;
  discountPercent?: string;
  previousBalance?: number;
  previousBalanceDescription?: string;
  shippingCharge?: number;
}

export interface SaleReportData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  gstin: string;
  state: string;
  reportTitle: string;
  durationFrom: string;
  durationTo: string;
  firm: string;
  user: string;
  transactions: SaleReportTransaction[];
  totalSale?: number;
  generatedOn?: string;
}

const BORDER = "1px solid #d2d2d2";
const BASE: CSSProperties = {
  fontFamily: "Arial, sans-serif",
  fontSize: "12px",
  color: "#111111",
};

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  const parsedDate = new Date(String(value || ""));

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-GB");
}

function formatGeneratedOn(value: Date) {
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeText(value: unknown, fallback = "") {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || fallback;
}

function resolveAmount(...values: unknown[]) {
  for (const value of values) {
    const nextValue = Number(value);
    if (Number.isFinite(nextValue)) {
      return nextValue;
    }
  }

  return 0;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  const nextValue = new Date(value);
  nextValue.setHours(0, 0, 0, 0);
  return nextValue;
}

function endOfDay(value: Date) {
  const nextValue = new Date(value);
  nextValue.setHours(23, 59, 59, 999);
  return nextValue;
}

function shiftDays(value: Date, days: number) {
  const nextValue = new Date(value);
  nextValue.setDate(nextValue.getDate() + days);
  return nextValue;
}

function buildSaleReportData(payload: AdminSalesReportPayload): SaleReportData {
  const normalizedTransactions = [...(payload.transactions || [])].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return {
    companyName: "Grass Green Nursery",
    companyAddress: "Sales report generated from live admin sales data.",
    companyPhone: "",
    companyEmail: "",
    gstin: "",
    state: "",
    reportTitle: "Sale Report",
    durationFrom: formatDate(payload.durationFrom) || "-",
    durationTo: formatDate(payload.durationTo) || "-",
    firm: "All firms",
    user: "All Users",
    generatedOn: formatGeneratedOn(
      payload.generatedOn ? new Date(payload.generatedOn) : new Date(),
    ),
    totalSale: payload.summary.totalSale,
    transactions: normalizedTransactions.map((transaction, transactionIndex) => ({
      id: transaction.id,
      createdAt: transaction.createdAt,
      date: formatDate(transaction.date || transaction.createdAt),
      orderNo: transaction.orderNo || transactionIndex + 1,
      invoiceNo: transaction.invoiceNo || transactionIndex + 1,
      partyName: normalizeText(transaction.partyName, "Customer"),
      gstin: normalizeText(transaction.gstin),
      partyPhone: normalizeText(transaction.partyPhone),
      transactionType: normalizeText(transaction.transactionType, "Sale"),
      total: resolveAmount(transaction.total),
      paymentType: normalizeText(transaction.paymentType, "Payment"),
      received: resolveAmount(transaction.received),
      balanceDue: resolveAmount(transaction.balanceDue),
      dueDate: formatDate(transaction.dueDate),
      status: normalizeText(transaction.status, "Paid"),
      overdueDays: resolveAmount(transaction.overdueDays),
      items: (transaction.items || []).map((item, itemIndex) => ({
        sNo: resolveAmount(item.sNo, itemIndex + 1),
        itemName: normalizeText(item.itemName, `Item ${itemIndex + 1}`),
        hsnSac: normalizeText(item.hsnSac),
        quantity: resolveAmount(item.quantity, 1),
        unit: normalizeText(item.unit),
        pricePerUnit: resolveAmount(item.pricePerUnit),
        taxablePricePerUnit: resolveAmount(
          item.taxablePricePerUnit,
          item.pricePerUnit,
        ),
        finalRate: resolveAmount(item.finalRate, item.pricePerUnit),
        discount: resolveAmount(item.discount),
        discountPercent: normalizeText(item.discountPercent),
        amount: resolveAmount(item.amount),
      })),
      discount: resolveAmount(transaction.discount),
      discountPercent: normalizeText(transaction.discountPercent),
      shippingCharge: resolveAmount(transaction.shippingCharge),
    })),
  };
}

function buildFilteredReportData(
  baseReport: SaleReportData,
  transactions: SaleReportTransaction[],
  label: string,
) {
  const totalSale = transactions.reduce(
    (sum, transaction) => sum + resolveAmount(transaction.total),
    0,
  );

  return {
    ...baseReport,
    reportTitle:
      label === "All dates" ? baseReport.reportTitle : `${baseReport.reportTitle} - ${label}`,
    durationFrom: transactions.length ? transactions[0]?.date || "-" : "-",
    durationTo: transactions.length
      ? transactions[transactions.length - 1]?.date || "-"
      : "-",
    transactions,
    totalSale,
    generatedOn: formatGeneratedOn(new Date()),
  };
}

function SaleReport({ data }: { data: SaleReportData }) {
  return (
    <div
      style={{
        ...BASE,
        backgroundColor: "#ffffff",
        padding: "24px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
            {data.reportTitle}
          </h1>
          <p style={{ margin: "8px 0 0", color: "#4c4c4c" }}>
            Duration: {data.durationFrom} to {data.durationTo}
          </p>
          <p style={{ margin: "4px 0 0", color: "#4c4c4c" }}>
            Firm: {data.firm} | User: {data.user}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", fontWeight: 700 }}>{data.companyName}</div>
          <div style={{ marginTop: "6px", color: "#4c4c4c" }}>{data.companyAddress}</div>
          {data.companyPhone ? <div>Phone: {data.companyPhone}</div> : null}
          {data.companyEmail ? <div>Email: {data.companyEmail}</div> : null}
          {data.gstin ? <div>GSTIN: {data.gstin}</div> : null}
          {data.state ? <div>State: {data.state}</div> : null}
        </div>
      </div>

      <div style={{ marginTop: "18px", border: BORDER }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#efefef" }}>
              {[
                "Date",
                "Order No",
                "Invoice No",
                "Party Name",
                "Phone",
                "Payment",
                "Total",
                "Received",
                "Balance",
                "Status",
              ].map((label) => (
                <th
                  key={label}
                  style={{
                    ...BASE,
                    border: BORDER,
                    padding: "8px",
                    textAlign: "left",
                    fontWeight: 700,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((transaction, transactionIndex) => (
              <tr key={`${transaction.invoiceNo}-${transactionIndex}`}>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.date}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.orderNo || ""}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.invoiceNo}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  <div style={{ fontWeight: 700 }}>{transaction.partyName}</div>
                  {transaction.items.length ? (
                    <div style={{ marginTop: "6px", color: "#4c4c4c", fontSize: "11px" }}>
                      {transaction.items.map((item) => (
                        <div key={`${transaction.invoiceNo}-${item.sNo}`}>
                          {item.sNo}. {item.itemName} | Qty {item.quantity}
                          {item.unit ? ` ${item.unit}` : ""} | {formatCurrency(item.amount)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.partyPhone || ""}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.paymentType || ""}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px", textAlign: "right" }}>
                  {formatCurrency(transaction.total)}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px", textAlign: "right" }}>
                  {formatCurrency(transaction.received)}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px", textAlign: "right" }}>
                  {formatCurrency(transaction.balanceDue)}
                </td>
                <td style={{ ...BASE, border: BORDER, padding: "8px" }}>
                  {transaction.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalSale !== undefined ? (
        <div
          style={{
            marginTop: "16px",
            textAlign: "right",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          Total Sale: {formatCurrency(data.totalSale)}
        </div>
      ) : null}

      {data.generatedOn ? (
        <div style={{ marginTop: "12px", textAlign: "right", color: "#6a6a6a" }}>
          Generated on {data.generatedOn}
        </div>
      ) : null}
    </div>
  );
}

function buildSingleTransactionReportData(
  baseReport: SaleReportData,
  transaction: SaleReportTransaction,
) {
  return {
    ...baseReport,
    reportTitle: `Sale Report - Invoice ${transaction.invoiceNo}`,
    transactions: [transaction],
    totalSale: transaction.total,
    durationFrom: transaction.date,
    durationTo: transaction.date,
    generatedOn: formatGeneratedOn(new Date()),
  };
}

function getPresetRange(preset: Exclude<DatePreset, "custom">) {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  if (preset === "all") {
    return { from: "", to: "" };
  }

  if (preset === "today") {
    return {
      from: toDateInputValue(todayStart),
      to: toDateInputValue(todayEnd),
    };
  }

  if (preset === "yesterday") {
    const yesterday = shiftDays(today, -1);
    return {
      from: toDateInputValue(startOfDay(yesterday)),
      to: toDateInputValue(endOfDay(yesterday)),
    };
  }

  if (preset === "last_7_days") {
    return {
      from: toDateInputValue(startOfDay(shiftDays(today, -6))),
      to: toDateInputValue(todayEnd),
    };
  }

  return {
    from: toDateInputValue(startOfDay(shiftDays(today, -29))),
    to: toDateInputValue(todayEnd),
  };
}

function getPresetLabel(preset: DatePreset, fromDate: string, toDate: string) {
  if (preset === "today") {
    return "Today";
  }

  if (preset === "yesterday") {
    return "Yesterday";
  }

  if (preset === "last_7_days") {
    return "Last 7 days";
  }

  if (preset === "last_30_days") {
    return "Last 30 days";
  }

  if (preset === "custom" && (fromDate || toDate)) {
    return `${fromDate || "Start"} to ${toDate || "End"}`;
  }

  return "All dates";
}

export default function SalesReportPage() {
  const { authorizedRequest } = useAdminAuth();
  const [salesPayload, setSalesPayload] = useState<AdminSalesReportPayload | null>(null);
  const [reportData, setReportData] = useState<SaleReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function loadReportData() {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedRequest<ApiResponse<AdminSalesReportPayload>>(
        "/admin/sales-report",
      );

      setSalesPayload(response.data);
      setReportData(buildSaleReportData(response.data));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load the sales report.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncReportData() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<AdminSalesReportPayload>>(
            "/admin/sales-report",
          );

        if (!cancelled) {
          setSalesPayload(response.data);
          setReportData(buildSaleReportData(response.data));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the sales report.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncReportData();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const filteredTransactions = [...(reportData?.transactions || [])]
    .filter((transaction) => {
      const transactionDate = transaction.createdAt
        ? new Date(transaction.createdAt)
        : new Date(transaction.date);

      if (Number.isNaN(transactionDate.getTime())) {
        return false;
      }

      if (fromDate) {
        const fromBoundary = startOfDay(new Date(fromDate));
        if (transactionDate < fromBoundary) {
          return false;
        }
      }

      if (toDate) {
        const toBoundary = endOfDay(new Date(toDate));
        if (transactionDate > toBoundary) {
          return false;
        }
      }

      return true;
    })
    .filter((transaction) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();

      if (!normalizedQuery) {
        return true;
      }

      return [
        transaction.date,
        transaction.invoiceNo,
        transaction.partyName,
        transaction.transactionType,
        transaction.paymentType,
        transaction.total,
        transaction.balanceDue,
        transaction.dueDate,
        transaction.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort(
      (left, right) =>
        new Date(left.createdAt || left.date).getTime() -
        new Date(right.createdAt || right.date).getTime(),
    );

  const filteredLabel = getPresetLabel(datePreset, fromDate, toDate);
  const filteredReportData = reportData
    ? buildFilteredReportData(reportData, filteredTransactions, filteredLabel)
    : null;
  const filteredSummary = filteredTransactions.reduce(
    (accumulator, transaction) => {
      accumulator.totalSale += resolveAmount(transaction.total);
      accumulator.totalReceived += resolveAmount(transaction.received);
      accumulator.totalOutstanding += resolveAmount(transaction.balanceDue);
      if (transaction.status === "Paid") {
        accumulator.paidCount += 1;
      } else {
        accumulator.overdueCount += 1;
      }
      return accumulator;
    },
    {
      totalSale: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      paidCount: 0,
      overdueCount: 0,
    },
  );

  function applyPreset(nextPreset: Exclude<DatePreset, "custom">) {
    const nextRange = getPresetRange(nextPreset);
    setDatePreset(nextPreset);
    setFromDate(nextRange.from);
    setToDate(nextRange.to);
  }

  function openReportPrintWindow(nextReportData: SaleReportData) {
    const reportWindow = window.open("", "_blank", "width=1400,height=900");
    const markup = renderToStaticMarkup(<SaleReport data={nextReportData} />);

    if (!reportWindow) {
      return false;
    }

    reportWindow.document.write(`
      <html>
        <head>
          <title>${nextReportData.reportTitle}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { margin: 0; background: #ffffff; }
          </style>
        </head>
        <body>${markup}</body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
    reportWindow.onafterprint = () => {
      reportWindow.close();
    };

    return true;
  }

  function handleExportPdf() {
    if (!filteredReportData || !filteredTransactions.length) {
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const isOpened = openReportPrintWindow(filteredReportData);

      if (!isOpened) {
        setError("Please allow popups to export the PDF report.");
      }
    } finally {
      setExporting(false);
    }
  }

  function handleExportTransaction(transaction: SaleReportTransaction) {
    if (!reportData) {
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const isOpened = openReportPrintWindow(
        buildSingleTransactionReportData(reportData, transaction),
      );

      if (!isOpened) {
        setError("Please allow popups to export the PDF report.");
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Revenue Overview"
        title="Sales Report"
        description="Filter sales by date range, review the live rows, and export only the currently selected report window."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Filtered Sales"
          value={formatCurrency(filteredSummary.totalSale)}
          meta={`${filteredTransactions.length} rows in ${filteredLabel.toLowerCase()}`}
        />
        <AdminMetricCard
          label="Received"
          value={formatCurrency(filteredSummary.totalReceived)}
          meta={`${filteredSummary.paidCount} fully paid invoices`}
        />
        <AdminMetricCard
          label="Outstanding"
          value={formatCurrency(filteredSummary.totalOutstanding)}
          meta={`${filteredSummary.overdueCount} invoices still carrying balance`}
        />
        <AdminMetricCard
          label="All-Time Sales"
          value={formatCurrency(salesPayload?.summary.totalSale || 0)}
          meta={`${salesPayload?.summary.totalRecords || 0} total sales rows available`}
        />
      </div>

      <AdminPanel className="p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          <div className="xl:min-w-0 xl:flex-[1.6]">
            <AdminTextInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
            />
          </div>
          <div className="xl:flex-[0.55]">
            <AdminSelect
              value={datePreset}
              onChange={(event) =>
                applyPreset(event.target.value as Exclude<DatePreset, "custom">)
              }
              className="w-full px-3 py-3"
            >
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last week</option>
              <option value="last_30_days">30 days</option>
            </AdminSelect>
          </div>
          <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-3 py-2.5 xl:flex-[1.05]">
            <AdminTextInput
              type="date"
              value={fromDate}
              onChange={(event) => {
                setDatePreset("custom");
                setFromDate(event.target.value);
              }}
              className="min-w-0 border-0 px-2 py-1 focus:ring-0"
            />
            <span className="text-sm font-semibold text-[var(--admin-muted)]">to</span>
            <AdminTextInput
              type="date"
              value={toDate}
              onChange={(event) => {
                setDatePreset("custom");
                setToDate(event.target.value);
              }}
              className="min-w-0 border-0 px-2 py-1 focus:ring-0"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--admin-muted)]">
              <p>
                Current filter:{" "}
                <span className="font-semibold text-[var(--admin-ink)]">{filteredLabel}</span>
              </p>
              <p>
                Search results:{" "}
                <span className="font-semibold text-[var(--admin-ink)]">
                  {filteredTransactions.length}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminActionButton
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exporting || loading || !filteredReportData || !filteredTransactions.length}
              >
                {exporting ? "Generating PDF..." : "Export Filtered Report"}
              </AdminActionButton>
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={() => void loadReportData()}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh Data"}
              </AdminActionButton>
            </div>
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-[1rem] border border-[#f1c7c3] bg-[#fff6f4] px-4 py-3 text-sm font-medium text-[#a73d31]">
            {error}
          </div>
        ) : null}
      </AdminPanel>

      <AdminPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--admin-line)] bg-[#f8faf6] text-left">
                {[
                  "Date",
                  "Invoice",
                  "Party Name",
                  "Transaction",
                  "Payment Type",
                  "Amount",
                  "Balance",
                  "Due Date",
                  "Status",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-muted)]"
                  >
                    Loading sales transactions...
                  </td>
                </tr>
              ) : !filteredTransactions.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-muted)]"
                  >
                    No sales transactions found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction, transactionIndex) => (
                  <tr
                    key={`${transaction.invoiceNo}-${transactionIndex}`}
                    className="border-b border-[var(--admin-line)] align-top transition hover:bg-[#fbfdf8]"
                  >
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      {transaction.date}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-[var(--admin-ink)]">
                      {transaction.invoiceNo}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      <div>{transaction.partyName}</div>
                      {transaction.partyPhone ? (
                        <div className="mt-1 text-xs text-[var(--admin-muted)]">
                          {transaction.partyPhone}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      {transaction.transactionType}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      {transaction.paymentType || "Payment"}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-[var(--admin-ink)]">
                      {formatCurrency(transaction.total)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      {formatCurrency(transaction.balanceDue)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--admin-ink)]">
                      {transaction.dueDate || "-"}
                    </td>
                    <td
                      className={`px-4 py-4 text-sm font-semibold ${
                        transaction.status === "Paid"
                          ? "text-[#23814d]"
                          : "text-[#c97911]"
                      }`}
                    >
                      {transaction.status}
                    </td>
                    <td className="px-4 py-4">
                      <AdminActionButton
                        type="button"
                        tone="secondary"
                        className="whitespace-nowrap"
                        onClick={() => handleExportTransaction(transaction)}
                        disabled={exporting}
                      >
                        Export PDF
                      </AdminActionButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
