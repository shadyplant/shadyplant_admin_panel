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
  AdminPill,
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminHomeCategoryItem, ApiResponse } from "@/lib/admin-api";
import { canManageCatalog } from "@/lib/admin-permissions";

export default function HomeCategoriesPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [items, setItems] = useState<AdminHomeCategoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
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
        description="Manage the category items shown on the storefront home page."
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
          <div className="flex items-center gap-3">
            <AdminPill>{items.length} total</AdminPill>
            <AdminPill>{items.filter((item) => item.isActive).length} active</AdminPill>
          </div>
        </div>
      </AdminPanel>

      {!filteredItems.length ? (
        <AdminEmptyCard
          title="No home bar items found"
          description="Create the first item to control the homepage category bar from admin."
        />
      ) : (
        <div className="space-y-4">
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--admin-line)] bg-[#f8faf6] text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Item
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Link
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Style
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--admin-line)] align-top transition hover:bg-[#fbfdf8]"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-[240px] items-start gap-3">
                          <div
                            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.9rem] p-[2px]"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${item.accentFrom}, ${item.accentVia}, ${item.accentTo})`,
                            }}
                          >
                            <div className="relative h-full w-full overflow-hidden rounded-[0.8rem] bg-white">
                              {item.showOfferBadge ? (
                                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#ff9d8b_0%,#ff6f67_62%,#ff5a5a_100%)] text-white text-xl font-black">
                                  %
                                </div>
                              ) : item.image ? (
                                <Image
                                  src={item.image}
                                  alt={item.label}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] font-semibold text-[var(--admin-muted)]">
                                  No image
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                              {item.itemKey}
                            </p>
                            <h2 className="mt-1 text-sm font-black text-[var(--admin-ink)]">
                              {item.label}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.showOfferBadge ? <AdminPill>Offer badge</AdminPill> : null}
                              {item.sortOrder > 0 ? (
                                <AdminPill>Order {item.sortOrder}</AdminPill>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[240px]">
                          <p className="break-all text-sm text-[var(--admin-muted)]">
                            {item.href}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[220px] space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border border-white shadow-[0_0_0_1px_rgba(24,49,26,0.08)]"
                              style={{ backgroundColor: item.accentFrom }}
                            />
                            <span
                              className="h-4 w-4 rounded-full border border-white shadow-[0_0_0_1px_rgba(24,49,26,0.08)]"
                              style={{ backgroundColor: item.accentVia }}
                            />
                            <span
                              className="h-4 w-4 rounded-full border border-white shadow-[0_0_0_1px_rgba(24,49,26,0.08)]"
                              style={{ backgroundColor: item.accentTo }}
                            />
                          </div>
                          <p className="text-xs text-[var(--admin-muted)]">
                            {item.image ? "Image item" : item.showOfferBadge ? "Badge item" : "No media"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[120px]">
                          <AdminStatusPill
                            status={item.isActive ? "active" : "disabled"}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[180px] flex-col gap-2">
                          <Link
                            href={`/home-categories/${item.id}`}
                            className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
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
