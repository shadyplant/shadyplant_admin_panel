"use client";

import Image from "next/image";
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
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminHomeCategoryItem, ApiResponse } from "@/lib/admin-api";
import { canManageCatalog } from "@/lib/admin-permissions";

export default function HomeCategoriesPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [items, setItems] = useState<AdminHomeCategoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const allowCatalogEdits = canManageCatalog(staff?.role);

  async function loadItems() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ items: AdminHomeCategoryItem[] }>>(
          "/admin/home-categories",
        );
      setItems(response.data.items);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load home category items.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncItems() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ items: AdminHomeCategoryItem[] }>>(
            "/admin/home-categories",
          );

        if (!cancelled) {
          setItems(response.data.items);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load home category items.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncItems();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  async function handleDelete(item: AdminHomeCategoryItem) {
    if (!allowCatalogEdits) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${item.label}" from the home bar?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingId(item.id);

    try {
      await authorizedRequest(`/admin/home-categories/${item.id}`, {
        method: "DELETE",
      });
      setItems((currentItems) => currentItems.filter((entry) => entry.id !== item.id));
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete home category item.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = items.filter((item) =>
    [item.label, item.itemKey, item.href]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  if (loading) {
    return <AdminLoadingCard label="Loading home category bar items..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadItems} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Homepage Merchandising"
        title="Home Category Bar"
        description="Manage the story-style category chips shown below the header on the storefront home page."
        actionLabel={allowCatalogEdits ? "Add Item" : undefined}
        actionHref={allowCatalogEdits ? "/home-categories/new" : undefined}
      />

      <AdminPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <AdminTextInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by label, key, or href"
            className="max-w-xl"
          />
          <p className="text-sm font-semibold text-[var(--admin-muted)]">
            {items.length} home bar items
          </p>
        </div>
      </AdminPanel>

      {!filteredItems.length ? (
        <AdminEmptyCard
          title="No home bar items found"
          description="Create the first item to control the homepage category bar from admin."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {paginatedItems.map((item) => (
              <AdminPanel key={item.id} className="p-0 overflow-hidden">
                <div className="grid gap-4 p-5 md:grid-cols-[108px_minmax(0,1fr)]">
                  <div
                    className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.4rem] p-[2px]"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentVia}, ${item.accentTo})`,
                    }}
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-[1.3rem] bg-white">
                      {item.showOfferBadge ? (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#ff9d8b_0%,#ff6f67_62%,#ff5a5a_100%)] text-white text-4xl font-black">
                          %
                        </div>
                      ) : item.image ? (
                        <Image
                          src={item.image}
                          alt={item.label}
                          fill
                          className="object-cover"
                          sizes="120px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-semibold text-[var(--admin-muted)]">
                          No image
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                          {item.itemKey}
                        </p>
                        <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                          {item.label}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)] break-all">
                          {item.href}
                        </p>
                      </div>
                      <AdminStatusPill status={item.isActive ? "active" : "disabled"} />
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/home-categories/${item.id}`}
                        className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                      >
                        Edit item
                      </Link>
                      {allowCatalogEdits ? (
                        <AdminActionButton
                          tone="danger"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "Deleting..." : "Delete"}
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
            totalItems={filteredItems.length}
            pageSize={pageSize}
            label="home bar items"
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
