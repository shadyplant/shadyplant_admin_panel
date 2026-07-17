"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CatalogMediaAssistant from "@/components/admin/CatalogMediaAssistant";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { showAdminSnackbar } from "@/components/admin/AdminSnackbar";
import MediaUploadInput from "@/components/admin/MediaUploadInput";
import { AdminActionButton, AdminPanel } from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName } from "@/components/admin/Forms";
import type { AdminHomeSliderBanner, ApiResponse } from "@/lib/admin-api";
import { canManageCatalog } from "@/lib/admin-permissions";

type HomeSliderBannerEditorPageProps = {
  itemId?: string;
};

type HomeSliderBannerFormState = {
  itemKey: string;
  title: string;
  actionType: "link" | "popup";
  href: string;
  popupKey: string;
  desktopImage: string;
  mobileImage: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: HomeSliderBannerFormState = {
  itemKey: "",
  title: "",
  actionType: "link",
  href: "/search",
  popupKey: "lawn-grass-estimate",
  desktopImage: "",
  mobileImage: "",
  sortOrder: "100",
  isActive: true,
};

function mapItemToForm(item: AdminHomeSliderBanner): HomeSliderBannerFormState {
  return {
    itemKey: item.itemKey || "",
    title: item.title || "",
    actionType: item.actionType === "popup" ? "popup" : "link",
    href: item.href || "/search",
    popupKey: item.popupKey || "lawn-grass-estimate",
    desktopImage: item.desktopImage || "",
    mobileImage: item.mobileImage || "",
    sortOrder: String(item.sortOrder ?? 100),
    isActive: Boolean(item.isActive),
  };
}

function buildPayload(form: HomeSliderBannerFormState) {
  return {
    itemKey: form.itemKey.trim() || undefined,
    title: form.title.trim(),
    actionType: form.actionType,
    href: form.href.trim(),
    popupKey: form.actionType === "popup" ? form.popupKey.trim() : "",
    desktopImage: form.desktopImage.trim(),
    mobileImage: form.mobileImage.trim(),
    sortOrder: Number(form.sortOrder || 0),
    isActive: form.isActive,
  };
}

export default function HomeSliderBannerEditorPage({
  itemId,
}: HomeSliderBannerEditorPageProps) {
  const router = useRouter();
  const { authorizedRequest, staff } = useAdminAuth();
  const [form, setForm] = useState<HomeSliderBannerFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(itemId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const allowCatalogEdits = canManageCatalog(staff?.role);

  async function loadItem() {
    if (!itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ item: AdminHomeSliderBanner }>>(
          `/admin/home-slider-banners/${itemId}`,
        );
      setForm(mapItemToForm(response.data.item));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load home slider banner.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!itemId) {
      return;
    }

    let cancelled = false;

    async function syncItem() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ item: AdminHomeSliderBanner }>>(
            `/admin/home-slider-banners/${itemId}`,
          );

        if (!cancelled) {
          setForm(mapItemToForm(response.data.item));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load home slider banner.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncItem();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, itemId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ item: AdminHomeSliderBanner }>>(
          itemId
            ? `/admin/home-slider-banners/${itemId}`
            : "/admin/home-slider-banners",
          {
            method: itemId ? "PATCH" : "POST",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setForm(mapItemToForm(response.data.item));
      showAdminSnackbar({
        tone: "success",
        title: itemId ? "Home slider banner updated" : "Home slider banner created",
        body: `${response.data.item.title} was saved successfully.`,
      });
      setSuccessMessage(
        itemId
          ? "Home slider banner updated successfully."
          : "Home slider banner created successfully.",
      );

      if (!itemId) {
        router.replace(`/home-slider-banners/${response.data.item.id}`);
      }
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: itemId ? "Home slider banner update failed" : "Home slider banner create failed",
        body:
          nextError instanceof Error
            ? nextError.message
            : "Unable to save home slider banner.",
      });
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save home slider banner.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!itemId || !allowCatalogEdits) {
      return;
    }

    const shouldDelete = window.confirm("Delete this home slider banner?");

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      await authorizedRequest(`/admin/home-slider-banners/${itemId}`, {
        method: "DELETE",
      });
      showAdminSnackbar({
        tone: "success",
        title: "Home slider banner deleted",
        body: `${form.title || "This banner"} was removed successfully.`,
      });
      router.replace("/home-slider-banners");
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Home slider banner delete failed",
        body:
          nextError instanceof Error
            ? nextError.message
            : "Unable to delete home slider banner.",
      });
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete home slider banner.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading home slider banner editor..." />;
  }

  if (error && itemId && !form.title) {
    return <AdminErrorCard message={error} onRetry={loadItem} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Homepage Merchandising"
        title={itemId ? "Edit Home Slider Banner" : "Create Home Slider Banner"}
        description="Manage separate desktop and mobile images for the storefront home slider."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <CatalogMediaAssistant
          primaryImage={form.desktopImage}
          galleryImages={form.mobileImage ? [form.mobileImage] : []}
          entityLabel="home slider banner"
        />

        <AdminPanel>
          <FormGrid>
              <FormField label="Banner key">
                <input
                  value={form.itemKey}
                  onChange={(event) => setForm({ ...form, itemKey: event.target.value })}
                  className={inputClassName()}
                  placeholder="fresh-lawn-grass"
                />
              </FormField>
            <FormField label="Title">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className={inputClassName()}
                placeholder="Fresh lawn grass"
                required
              />
            </FormField>
            <FormField label="Banner action">
              <select
                value={form.actionType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    actionType:
                      event.target.value === "popup" ? "popup" : "link",
                  })
                }
                className={inputClassName()}
              >
                <option value="link">Open URL page</option>
                <option value="popup">Open popup</option>
              </select>
            </FormField>
            {form.actionType === "popup" ? (
              <FormField label="Popup">
                <select
                  value={form.popupKey}
                  onChange={(event) =>
                    setForm({ ...form, popupKey: event.target.value })
                  }
                  className={inputClassName()}
                >
                  <option value="lawn-grass-estimate">
                    Lawn grass order estimate
                  </option>
                </select>
              </FormField>
            ) : (
              <FormField label="Href">
                <input
                  value={form.href}
                  onChange={(event) => setForm({ ...form, href: event.target.value })}
                  className={inputClassName()}
                  placeholder="/search?category=Lawn%20Grass"
                />
              </FormField>
            )}
            <FormField label="Sort order">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                className={inputClassName()}
                placeholder="100"
              />
            </FormField>
            <FormField label="Desktop image URL">
              <MediaUploadInput
                label="Desktop image URL"
                value={form.desktopImage}
                onChange={(nextImage) =>
                  setForm({ ...form, desktopImage: nextImage })
                }
                entityType="home-slider-banner"
                entityId={itemId || form.itemKey || form.title || "home-slider-banner-draft"}
                slotKey="desktop"
                purpose="home-slider-desktop-image"
                allowEdits={allowCatalogEdits}
                placeholder="https://..."
                hint="Upload the desktop banner to S3 or paste a hosted URL."
              />
            </FormField>
            <FormField label="Mobile image URL">
              <MediaUploadInput
                label="Mobile image URL"
                value={form.mobileImage}
                onChange={(nextImage) =>
                  setForm({ ...form, mobileImage: nextImage })
                }
                entityType="home-slider-banner"
                entityId={itemId || form.itemKey || form.title || "home-slider-banner-draft"}
                slotKey="mobile"
                purpose="home-slider-mobile-image"
                allowEdits={allowCatalogEdits}
                placeholder="https://..."
                hint="Upload the mobile banner to S3 or paste a hosted URL."
              />
            </FormField>
          </FormGrid>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Display options
              </p>
              <label className="mt-4 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
                Keep this banner active on the storefront
              </label>
            </div>

            <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Live preview
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                    Desktop
                  </p>
                  <div className="relative aspect-[16/6] overflow-hidden rounded-[0.9rem] border border-[var(--admin-line)] bg-[var(--admin-chip)]">
                    {form.desktopImage ? (
                      <Image
                        src={form.desktopImage}
                        alt={form.title || "Desktop preview"}
                        fill
                        className="object-cover"
                        sizes="420px"
                      />
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                    Mobile
                  </p>
                  <div className="relative mx-auto aspect-[9/14] w-[130px] overflow-hidden rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)]">
                    {form.mobileImage ? (
                      <Image
                        src={form.mobileImage}
                        alt={form.title || "Mobile preview"}
                        fill
                        className="object-cover"
                        sizes="130px"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
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
              Your role can review home slider banners, but catalog-authorized staff should make changes.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || !allowCatalogEdits}
            >
              {saving ? "Saving..." : itemId ? "Save changes" : "Create banner"}
            </AdminActionButton>
            <Link
              href="/home-slider-banners"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to home slider
            </Link>
            {itemId ? (
              <AdminActionButton
                type="button"
                tone="danger"
                onClick={handleDelete}
                disabled={deleting || !allowCatalogEdits}
              >
                {deleting ? "Deleting..." : "Delete banner"}
              </AdminActionButton>
            ) : null}
          </div>
        </AdminPanel>
      </form>
    </div>
  );
}
