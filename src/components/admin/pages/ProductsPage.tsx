"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminEmptyCard, AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminPill,
  AdminSectionTitle,
  AdminSelect,
  AdminTextInput,
  AdminTextarea,
  AdminToolbar,
} from "@/components/admin/AdminUi";
import type {
  AdminProduct,
  AdminProductStockAdjustment,
  AdminProductStockAdjustmentLog,
  ApiResponse,
} from "@/lib/admin-api";
import { formatAdminCurrency } from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

const STOCK_REASON_OPTIONS = {
  add: [
    { value: "received", label: "Received" },
    { value: "audit_found", label: "Audit found" },
    { value: "return_restock", label: "Return restock" },
    { value: "manual_correction", label: "Manual correction" },
  ],
  adjust: [
    { value: "audit_correction", label: "Audit correction" },
    { value: "damaged", label: "Damaged" },
    { value: "expired", label: "Expired" },
    { value: "shrinkage", label: "Shrinkage" },
    { value: "manual_correction", label: "Manual correction" },
  ],
} as const;

export default function ProductsPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<AdminProduct | null>(null);
  const [confirmOperation, setConfirmOperation] = useState<"add" | "adjust">("add");
  const [modalQuantity, setModalQuantity] = useState("1");
  const [modalReason, setModalReason] = useState("received");
  const [stockNote, setStockNote] = useState("");
  const [stockLogs, setStockLogs] = useState<AdminProductStockAdjustmentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>(
          "/admin/products",
        );
      setProducts(response.data.products);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load products.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(product: AdminProduct) {
    const shouldDelete = window.confirm(
      `Delete ${product.name}? This removes it from the catalog.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(product.id);

    try {
      await authorizedRequest(`/admin/products/${product.id}`, {
        method: "DELETE",
      });
      setProducts((currentProducts) =>
        currentProducts.filter((entry) => entry.id !== product.id),
      );
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete product right now.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function openAdjustModal(
    product: AdminProduct,
    operation: "add" | "adjust",
  ) {
    setConfirmProduct(product);
    setConfirmOperation(operation);
    setModalQuantity(operation === "add" ? "1" : String(product.stock ?? 0));
    setModalReason(operation === "add" ? "received" : "audit_correction");
    setStockNote("");
    setLogsLoading(true);

    try {
      const response = await authorizedRequest<
        ApiResponse<{
          product: Pick<AdminProduct, "id" | "productId" | "name" | "stock">;
          logs: AdminProductStockAdjustmentLog[];
        }>
      >(`/admin/products/${product.id}/stock-logs?limit=8`);
      setStockLogs(response.data.logs);
    } catch {
      setStockLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAdjustStock() {
    if (!confirmProduct) {
      return;
    }

    const product = confirmProduct;
    const rawQuantity = modalQuantity;
    const quantity = Math.floor(Number(rawQuantity || 0));
    const reason = modalReason || "manual_correction";

    if (confirmOperation === "add") {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        window.alert("Enter a stock quantity greater than zero.");
        return;
      }
    } else if (!Number.isFinite(quantity) || quantity < 0) {
      window.alert("Enter the final available stock as zero or greater.");
      return;
    }

    setAdjustingId(product.id);

    try {
      const response = await authorizedRequest<
        ApiResponse<{
          product: AdminProduct;
          adjustment: AdminProductStockAdjustment;
        }>
      >(`/admin/products/${product.id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({
          operation: confirmOperation,
          ...(confirmOperation === "add"
            ? { quantity }
            : { nextStock: quantity }),
          reason,
          note: stockNote,
        }),
      });

      setProducts((currentProducts) =>
        currentProducts.map((entry) =>
          entry.id === product.id ? response.data.product : entry,
        ),
      );
      setConfirmProduct(null);
      setStockLogs((currentLogs) => [
        {
          id: `temp-${Date.now()}`,
          productId: response.data.product.id,
          productReference: response.data.product.productId,
          productName: response.data.product.name,
          operation: response.data.adjustment.operation,
          quantity: response.data.adjustment.quantity,
          delta: response.data.adjustment.delta,
          reason: response.data.adjustment.reason || "",
          note: response.data.adjustment.note || "",
          previousStock: response.data.adjustment.previousStock,
          currentStock: response.data.adjustment.currentStock,
          actor: {
            staffAccountId: "",
            email: staff?.email || "",
            role: staff?.role || "",
          },
          createdAt: response.data.adjustment.adjustedAt,
          updatedAt: response.data.adjustment.adjustedAt,
        },
        ...currentLogs,
      ]);
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to adjust stock right now.",
      );
    } finally {
      setAdjustingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncProducts() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>(
            "/admin/products",
          );

        if (!cancelled) {
          setProducts(response.data.products);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load products.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncProducts();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];
  const filteredProducts = products.filter((product) => {
    const searchableValue = [
      product.name,
      product.category,
      product.productId,
      product.badge,
      product.description,
      ...(product.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = searchableValue.includes(query.trim().toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;

    return matchesQuery && matchesCategory;
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const allowCatalogEdits = canManageCatalog(staff?.role);
  const availableReasonOptions = STOCK_REASON_OPTIONS[confirmOperation];

  if (loading) {
    return <AdminLoadingCard label="Loading products..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadProducts} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage the live storefront catalog, product imagery, pricing, positioning flags, and descriptive metadata."
        actionLabel={allowCatalogEdits ? "Add Product" : undefined}
        actionHref={allowCatalogEdits ? "/products/new" : undefined}
      />

      <AdminPanel>
        <AdminToolbar className="justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, product id, category, or tag"
              className="max-w-xl"
            />
            <AdminSelect
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div className="flex items-center gap-3">
            <AdminPill>{products.length} total</AdminPill>
            <AdminPill>
              {products.filter((product) => product.isFeaturedLatest).length} featured
            </AdminPill>
          </div>
        </AdminToolbar>
      </AdminPanel>

      {!filteredProducts.length ? (
        <AdminEmptyCard
          title="No products found"
          description="Try a different search term or add a new catalog product."
        />
      ) : (
        <div className="space-y-4">
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--admin-line)] bg-[linear-gradient(180deg,#fbfdf8,#f4f8ef)] text-left">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Product
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Category
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Price
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Stock
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Stock Adjust
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Flags
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-[var(--admin-line)] align-top transition hover:bg-[#fbfdf8]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-[280px] items-start gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[0.9rem] bg-[var(--admin-chip)]">
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[11px] font-semibold text-[var(--admin-muted)]">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                              {product.productId}
                            </p>
                            <h2 className="mt-0.5 text-sm font-black text-[var(--admin-ink)]">
                              {product.name}
                            </h2>
                            <p className="mt-0.5 line-clamp-1 max-w-xl text-sm leading-5 text-[var(--admin-muted)]">
                              {product.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[150px]">
                          <p className="text-sm font-semibold text-[var(--admin-ink)]">
                            {product.category || "Uncategorized"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[120px]">
                          <p className="text-sm font-black text-[var(--admin-accent)]">
                            {formatAdminCurrency(product.price)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[120px]">
                          <p className="text-sm font-semibold text-[var(--admin-ink)]">
                            {product.stock > 0 ? product.stock : 0}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[220px] items-center gap-2">
                            <AdminActionButton
                              onClick={() => void openAdjustModal(product, "add")}
                              disabled={adjustingId === product.id || !allowCatalogEdits}
                              className="min-w-[96px] px-3 py-2"
                            >
                              Stock Add
                            </AdminActionButton>
                            <AdminActionButton
                              tone="danger"
                              onClick={() => void openAdjustModal(product, "adjust")}
                              disabled={adjustingId === product.id || !allowCatalogEdits}
                              className="min-w-[120px] px-3 py-2"
                            >
                              Adjust Stock
                            </AdminActionButton>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[220px] flex-wrap gap-2">
                          {product.isFeaturedLatest ? (
                            <AdminPill>Featured</AdminPill>
                          ) : null}
                          {product.isOnTrend ? <AdminPill>Trending</AdminPill> : null}
                          {product.optionGroups?.length ? (
                            <AdminPill>{product.optionGroups.length} options</AdminPill>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[180px] flex-row items-center gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="inline-flex min-w-[112px] items-center justify-center rounded-full bg-[var(--admin-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            Edit
                          </Link>
                          {allowCatalogEdits ? (
                            <AdminActionButton
                              tone="danger"
                              onClick={() => handleDelete(product)}
                              disabled={deletingId === product.id}
                              className="min-w-[96px] px-3 py-2"
                            >
                              {deletingId === product.id ? "Deleting..." : "Delete"}
                            </AdminActionButton>
                          ) : null}
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
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            label="products"
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {confirmProduct ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,12,0.42)] p-4">
          <div className="w-full max-w-2xl rounded-[1.25rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_24px_80px_rgba(18,43,16,0.2)]">
            <AdminSectionTitle
              title={`${confirmOperation === "add" ? "Add" : "Adjust"} stock`}
              description={`Confirm stock adjustment for ${confirmProduct.name}.`}
            />

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-[1rem] bg-[var(--admin-chip)] p-4">
                <div className="text-sm text-[var(--admin-muted)]">
                  Product
                </div>
                <div className="text-base font-black text-[var(--admin-ink)]">
                  {confirmProduct.name}
                </div>
                <div className="text-sm text-[var(--admin-muted)]">
                  Current stock: <span className="font-semibold text-[var(--admin-ink)]">{confirmProduct.stock}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={modalQuantity}
                    onChange={(event) => setModalQuantity(event.target.value)}
                    placeholder={confirmOperation === "add" ? "Quantity" : "New available stock"}
                  />
                  <AdminSelect
                    value={modalReason}
                    onChange={(event) => setModalReason(event.target.value)}
                  >
                    {availableReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <AdminTextarea
                  value={stockNote}
                  onChange={(event) => setStockNote(event.target.value)}
                  placeholder="Optional note for audit log"
                  className="min-h-[96px]"
                />
              </div>

              <div className="space-y-3">
                <div className="rounded-[1rem] border border-[var(--admin-line)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                    Recent audit logs
                  </p>
                  <div className="mt-3 space-y-3">
                    {logsLoading ? (
                      <p className="text-sm text-[var(--admin-muted)]">Loading logs...</p>
                    ) : stockLogs.length ? (
                      stockLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-[0.9rem] bg-[var(--admin-chip)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--admin-ink)]">
                              {log.operation === "add"
                                ? `+${log.quantity}`
                                : `Set to ${log.currentStock}`}
                            </span>
                            <span className="text-xs uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                              {log.reason.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--admin-muted)]">
                            {log.previousStock} to {log.currentStock}
                            {log.actor.email ? ` by ${log.actor.email}` : ""}
                          </p>
                          {log.note ? (
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">{log.note}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--admin-muted)]">No stock audit logs yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <AdminActionButton
                tone="secondary"
                onClick={() => setConfirmProduct(null)}
                disabled={adjustingId === confirmProduct.id}
              >
                Cancel
              </AdminActionButton>
              <AdminActionButton
                tone={confirmOperation === "adjust" ? "secondary" : "primary"}
                onClick={() => void handleAdjustStock()}
                disabled={adjustingId === confirmProduct.id}
              >
                {adjustingId === confirmProduct.id
                  ? "Saving..."
                  : confirmOperation === "add"
                    ? "Confirm Add"
                    : "Confirm Adjust"}
              </AdminActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
