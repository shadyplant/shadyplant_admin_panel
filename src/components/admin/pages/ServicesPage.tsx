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
  AdminStatusPill,
  AdminTextInput,
} from "@/components/admin/AdminUi";
import type { AdminService, ApiResponse } from "@/lib/admin-api";
import { formatAdminCurrency } from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

export default function ServicesPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [services, setServices] = useState<AdminService[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadServices() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ services: AdminService[] }>>(
          "/admin/services",
        );
      setServices(response.data.services);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load services.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncServices() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ services: AdminService[] }>>(
            "/admin/services",
          );

        if (!cancelled) {
          setServices(response.data.services);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load services.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncServices();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest]);

  async function handleDelete(service: AdminService) {
    const shouldDelete = window.confirm(
      `Delete ${service.name}? This removes it from your service catalog.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(service.id);

    try {
      await authorizedRequest(`/admin/services/${service.id}`, {
        method: "DELETE",
      });
      setServices((currentServices) =>
        currentServices.filter((entry) => entry.id !== service.id),
      );
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete service right now.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredServices = services.filter((service) => {
    const searchableValue = [
      service.name,
      service.slug,
      service.category,
      service.badge,
      service.description,
      ...(service.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = searchableValue.includes(query.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? service.isActive : !service.isActive);

    return matchesQuery && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedServices = filteredServices.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const allowCatalogEdits = canManageCatalog(staff?.role);

  if (loading) {
    return <AdminLoadingCard label="Loading services..." />;
  }

  if (error) {
    return <AdminErrorCard message={error} onRetry={loadServices} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Service Catalog"
        title="Services"
        description="Manage nursery services, pricing units, service-specific imagery, positioning badges, and organization-owned catalog entries."
        actionLabel={allowCatalogEdits ? "Add Service" : undefined}
        actionHref={allowCatalogEdits ? "/services/new" : undefined}
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
              placeholder="Search by service name, slug, category, or tag"
              className="max-w-xl"
            />
            <AdminSelect
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="md:w-[220px]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="disabled">Disabled only</option>
            </AdminSelect>
          </div>
          <div className="flex items-center gap-3">
            <AdminPill>{services.length} total</AdminPill>
            <AdminPill>
              {services.filter((service) => service.isActive).length} active
            </AdminPill>
          </div>
        </div>
      </AdminPanel>

      {!filteredServices.length ? (
        <AdminEmptyCard
          title="No services found"
          description="Try another search term or create the first service entry."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
          {paginatedServices.map((service) => (
            <AdminPanel key={service.id} className="p-0 overflow-hidden">
              <div className="grid gap-4 p-5 md:grid-cols-[140px_minmax(0,1fr)]">
                <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-[var(--admin-chip)]">
                  {service.image ? (
                    <Image
                      src={service.image}
                      alt={service.name}
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
                        {service.slug}
                      </p>
                      <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                        {service.name}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                        {service.description}
                      </p>
                    </div>
                    <p className="text-lg font-black text-[var(--admin-accent)]">
                      {formatAdminCurrency(service.price)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminPill>{service.category}</AdminPill>
                    <AdminPill>{service.unit}</AdminPill>
                    <AdminPill>{service.badge}</AdminPill>
                    <AdminStatusPill status={service.isActive ? "active" : "disabled"} />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/services/${service.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      Edit service
                    </Link>
                    {allowCatalogEdits ? (
                      <AdminActionButton
                        tone="danger"
                        onClick={() => handleDelete(service)}
                        disabled={deletingId === service.id}
                      >
                        {deletingId === service.id ? "Deleting..." : "Delete"}
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
            totalItems={filteredServices.length}
            pageSize={pageSize}
            label="services"
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
