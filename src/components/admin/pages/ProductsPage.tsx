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
  AdminSelect,
  AdminTextInput,
  AdminToolbar,
} from "@/components/admin/AdminUi";
import type { AdminProduct, ApiResponse } from "@/lib/admin-api";
import { formatAdminCurrency } from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

export default function ProductsPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          <div className="grid gap-4 xl:grid-cols-2">
          {paginatedProducts.map((product) => (
            <AdminPanel key={product.id} className="p-0 overflow-hidden">
              <div className="grid gap-4 p-5 md:grid-cols-[140px_minmax(0,1fr)]">
                <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-[var(--admin-chip)]">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-[var(--admin-muted)]">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                        {product.productId}
                      </p>
                      <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                        {product.name}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                        {product.description}
                      </p>
                    </div>
                    <p className="text-lg font-black text-[var(--admin-accent)]">
                      {formatAdminCurrency(product.price)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminPill>{product.category}</AdminPill>
                    <AdminPill>{product.packLabel}</AdminPill>
                    <AdminPill>{product.badge}</AdminPill>
                    <AdminPill>
                      {product.stock > 0 ? `Stock ${product.stock}` : "Out of stock"}
                    </AdminPill>
                    {product.stockAlertCount > 0 ? (
                      <AdminPill>{product.stockAlertCount} notify requests</AdminPill>
                    ) : null}
                    {product.isOnTrend ? <AdminPill>Trending</AdminPill> : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      Edit product
                    </Link>
                    {allowCatalogEdits ? (
                      <AdminActionButton
                        tone="danger"
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                      >
                        {deletingId === product.id ? "Deleting..." : "Delete"}
                      </AdminActionButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </AdminPanel>
          ))}
          </div>
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
    </div>
  );
}
