"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CatalogMediaAssistant from "@/components/admin/CatalogMediaAssistant";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName, textareaClassName } from "@/components/admin/Forms";
import type { AdminService, ApiResponse } from "@/lib/admin-api";
import {
  normalizeObjectRecord,
  prettyJson,
  safeJsonParse,
  splitCommaSeparatedValues,
  toCommaSeparatedValue,
} from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

type ServiceEditorPageProps = {
  serviceId?: string;
};

type ServiceFormState = {
  slug: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  badge: string;
  description: string;
  image: string;
  images: string;
  tags: string;
  isActive: boolean;
  metadata: string;
};

const emptyForm: ServiceFormState = {
  slug: "",
  name: "",
  category: "",
  price: "",
  unit: "",
  badge: "",
  description: "",
  image: "",
  images: "",
  tags: "",
  isActive: true,
  metadata: "{\n  \n}",
};

function mapServiceToForm(service: AdminService): ServiceFormState {
  return {
    slug: service.slug || "",
    name: service.name || "",
    category: service.category || "",
    price: String(service.price ?? ""),
    unit: service.unit || "",
    badge: service.badge || "",
    description: service.description || "",
    image: service.image || "",
    images: toCommaSeparatedValue(service.images || []),
    tags: toCommaSeparatedValue(service.tags || []),
    isActive: Boolean(service.isActive),
    metadata: prettyJson(service.metadata || {}),
  };
}

function buildPayload(form: ServiceFormState) {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    category: form.category.trim(),
    price: Number(form.price || 0),
    unit: form.unit.trim(),
    badge: form.badge.trim(),
    description: form.description.trim(),
    image: form.image.trim(),
    images: splitCommaSeparatedValues(form.images),
    tags: splitCommaSeparatedValues(form.tags),
    isActive: form.isActive,
    metadata: safeJsonParse(form.metadata, {}, normalizeObjectRecord),
  };
}

export default function ServiceEditorPage({ serviceId }: ServiceEditorPageProps) {
  const router = useRouter();
  const { authorizedRequest, staff } = useAdminAuth();
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(serviceId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowCatalogEdits = canManageCatalog(staff?.role);

  async function loadService() {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ service: AdminService }>>(
          `/admin/services/${serviceId}`,
        );
      setForm(mapServiceToForm(response.data.service));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load service details.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    let cancelled = false;

    async function syncService() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ service: AdminService }>>(
            `/admin/services/${serviceId}`,
          );

        if (cancelled) {
          return;
        }

        setForm(mapServiceToForm(response.data.service));
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load service details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncService();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, serviceId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ service: AdminService }>>(
          serviceId ? `/admin/services/${serviceId}` : "/admin/services",
          {
            method: serviceId ? "PATCH" : "POST",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setForm(mapServiceToForm(response.data.service));
      setSuccessMessage(
        serviceId
          ? "Service updated successfully."
          : "Service created successfully.",
      );

      if (!serviceId) {
        router.replace(`/services/${response.data.service.id}`);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save service.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!serviceId) {
      return;
    }

    const shouldDelete = window.confirm(
      "Delete this service from the organization catalog?",
    );

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      await authorizedRequest(`/admin/services/${serviceId}`, {
        method: "DELETE",
      });
      router.replace("/services");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete service.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading service editor..." />;
  }

  if (error && serviceId && !form.name) {
    return <AdminErrorCard message={error} onRetry={loadService} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Service Editor"
        title={serviceId ? "Edit Service" : "Create Service"}
        description="Configure nursery service offerings for your organization, including descriptive metadata, asset galleries, pricing unit, status, and operational metadata."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <CatalogMediaAssistant
          primaryImage={form.image}
          galleryImages={splitCommaSeparatedValues(form.images)}
          entityLabel="service"
        />

        <AdminPanel>
          <FormGrid>
            <FormField label="Slug">
              <input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                className={inputClassName()}
                placeholder="landscape-installation"
                required
              />
            </FormField>
            <FormField label="Name">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClassName()}
                placeholder="Landscape Installation"
                required
              />
            </FormField>
            <FormField label="Category">
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={inputClassName()}
                placeholder="Installation"
              />
            </FormField>
            <FormField label="Badge">
              <input
                value={form.badge}
                onChange={(event) => setForm({ ...form, badge: event.target.value })}
                className={inputClassName()}
                placeholder="Popular"
              />
            </FormField>
            <FormField label="Price">
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className={inputClassName()}
                placeholder="4999"
              />
            </FormField>
            <FormField label="Unit">
              <input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                className={inputClassName()}
                placeholder="project"
              />
            </FormField>
            <FormField label="Primary image">
              <input
                value={form.image}
                onChange={(event) => setForm({ ...form, image: event.target.value })}
                className={inputClassName()}
                placeholder="https://..."
              />
            </FormField>
            <FormField label="Gallery images">
              <input
                value={form.images}
                onChange={(event) => setForm({ ...form, images: event.target.value })}
                className={inputClassName()}
                placeholder="https://..., https://..."
              />
            </FormField>
          </FormGrid>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label="Tags">
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                className={inputClassName()}
                placeholder="landscaping, consultation, nursery"
              />
            </FormField>

            <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Service status
              </p>
              <label className="mt-4 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
                Keep this service active in the organization catalog
              </label>
            </div>
          </div>

          <div className="mt-5">
            <FormField label="Description">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className={textareaClassName()}
                placeholder="Describe the service shown on the storefront."
                required
              />
            </FormField>
          </div>

          <div className="mt-5">
            <FormField
              label="Metadata"
              hint="Optional JSON for service-specific operational data."
            >
              <AdminTextarea
                value={form.metadata}
                onChange={(event) =>
                  setForm({ ...form, metadata: event.target.value })
                }
              />
            </FormField>
          </div>

          {(error || successMessage) && (
            <div
              className={`mt-5 rounded-[1rem] px-4 py-3 text-sm font-medium ${
                error
                  ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
                  : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
              }`}
            >
              {error || successMessage}
            </div>
          )}
          {!allowCatalogEdits ? (
            <div className="mt-5 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
              Your role can inspect service data, but only catalog-authorized staff should publish changes.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || !allowCatalogEdits}
            >
              {saving ? "Saving..." : serviceId ? "Save changes" : "Create service"}
            </AdminActionButton>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to services
            </Link>
            {serviceId ? (
              <AdminActionButton
                type="button"
                tone="danger"
                onClick={handleDelete}
                disabled={deleting || !allowCatalogEdits}
              >
                {deleting ? "Deleting..." : "Delete service"}
              </AdminActionButton>
            ) : null}
          </div>
        </AdminPanel>
      </form>
    </div>
  );
}
