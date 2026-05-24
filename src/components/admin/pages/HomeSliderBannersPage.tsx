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
import type { AdminHomeSliderBanner, ApiResponse } from "@/lib/admin-api";
import { canManageCatalog } from "@/lib/admin-permissions";

export default function HomeSliderBannersPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [items, setItems] = useState<AdminHomeSliderBanner[]>([]);
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
        await authorizedRequest<ApiResponse<{ items: AdminHomeSliderBanner[] }>>(
          "/admin/home-slider-banners",
        );
      setItems(response.data.items);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load home slider banners.",
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
          await authorizedRequest<ApiResponse<{ items: AdminHomeSliderBanner[] }>>(
            "/admin/home-slider-banners",
          );

        if (!cancelled) {
          setItems(response.data.items);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load home slider banners.",
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

  async function handleDelete(item: AdminHomeSliderBanner) {
    if (!allowCatalogEdits) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${item.title}" from the home slider?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingId(item.id);

    try {
      await authorizedRequest(`/admin/home-slider-banners/${item.id}`, {
        method: "DELETE",
      });
      setItems((currentItems) => currentItems.filter((entry) => entry.id !== item.id));
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete home slider banner.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = items.filter((item) =>
    [item.title, item.itemKey, item.href]
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
    return <AdminLoadingCard label="Loading home slider banners..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadItems} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Homepage Merchandising"
        title="Home Slider Banners"
        description="Manage separate desktop and mobile hero banners shown in the storefront home slider."
        actionLabel={allowCatalogEdits ? "Add Banner" : undefined}
        actionHref={allowCatalogEdits ? "/home-slider-banners/new" : undefined}
      />

      <AdminPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <AdminTextInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by title, key, or href"
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
          title="No home slider banners found"
          description="Create the first banner to control separate desktop and mobile hero slides from admin."
        />
      ) : (
        <div className="space-y-4">
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--admin-line)] bg-[#f8faf6] text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Banner
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                      Media
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
                        <div className="min-w-[260px]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                            {item.itemKey}
                          </p>
                          <h2 className="mt-1 text-sm font-black text-[var(--admin-ink)]">
                            {item.title}
                          </h2>
                          <p className="mt-2 break-all text-xs text-[var(--admin-muted)]">
                            {item.href || "No link"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.sortOrder > 0 ? (
                              <AdminPill>Order {item.sortOrder}</AdminPill>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid min-w-[280px] gap-3 md:grid-cols-2">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                              Desktop
                            </p>
                            <div className="relative aspect-[16/6] overflow-hidden rounded-[0.9rem] border border-[var(--admin-line)] bg-[var(--admin-chip)]">
                              {item.desktopImage ? (
                                <Image
                                  src={item.desktopImage}
                                  alt={`${item.title} desktop`}
                                  fill
                                  className="object-cover"
                                  sizes="240px"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                              Mobile
                            </p>
                            <div className="relative mx-auto aspect-[9/14] w-[92px] overflow-hidden rounded-[0.9rem] border border-[var(--admin-line)] bg-[var(--admin-chip)]">
                              {item.mobileImage ? (
                                <Image
                                  src={item.mobileImage}
                                  alt={`${item.title} mobile`}
                                  fill
                                  className="object-cover"
                                  sizes="92px"
                                />
                              ) : null}
                            </div>
                          </div>
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
                            href={`/home-slider-banners/${item.id}`}
                            className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                          >
                            Edit banner
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
            label="home slider banners"
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
