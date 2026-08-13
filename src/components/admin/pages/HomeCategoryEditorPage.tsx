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
import type { AdminHomeCategoryItem, ApiResponse } from "@/lib/admin-api";
import { canManageCatalog } from "@/lib/admin-permissions";

type HomeCategoryEditorPageProps = {
  itemId?: string;
};

type HomeCategoryFormState = {
  itemKey: string;
  label: string;
  href: string;
  image: string;
  accentFrom: string;
  accentVia: string;
  accentTo: string;
  sortOrder: string;
  showOfferBadge: boolean;
  isActive: boolean;
};

const emptyForm: HomeCategoryFormState = {
  itemKey: "",
  label: "",
  href: "/search",
  image: "",
  accentFrom: "#d8c38f",
  accentVia: "#f0d9a6",
  accentTo: "#fbf3cf",
  sortOrder: "100",
  showOfferBadge: false,
  isActive: true,
};

function mapItemToForm(item: AdminHomeCategoryItem): HomeCategoryFormState {
  return {
    itemKey: item.itemKey || "",
    label: item.label || "",
    href: item.href || "/search",
    image: item.image || "",
    accentFrom: item.accentFrom || "#d8c38f",
    accentVia: item.accentVia || "#f0d9a6",
    accentTo: item.accentTo || "#fbf3cf",
    sortOrder: String(item.sortOrder ?? 100),
    showOfferBadge: Boolean(item.showOfferBadge),
    isActive: Boolean(item.isActive),
  };
}

function buildPayload(form: HomeCategoryFormState) {
  return {
    itemKey: form.itemKey.trim() || undefined,
    label: form.label.trim(),
    href: form.href.trim(),
    image: form.image.trim(),
    accentFrom: form.accentFrom.trim(),
    accentVia: form.accentVia.trim(),
    accentTo: form.accentTo.trim(),
    sortOrder: Number(form.sortOrder || 0),
    showOfferBadge: form.showOfferBadge,
    isActive: form.isActive,
  };
}

export default function HomeCategoryEditorPage({
  itemId,
}: HomeCategoryEditorPageProps) {
  const router = useRouter();
  const { authorizedRequest, staff } = useAdminAuth();
  const [form, setForm] = useState<HomeCategoryFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(itemId));
  const [saving, setSaving] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
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
        await authorizedRequest<ApiResponse<{ item: AdminHomeCategoryItem }>>(
          `/admin/home-categories/${itemId}`,
        );
      setForm(mapItemToForm(response.data.item));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load home bar item.",
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
          await authorizedRequest<ApiResponse<{ item: AdminHomeCategoryItem }>>(
            `/admin/home-categories/${itemId}`,
          );

        if (!cancelled) {
          setForm(mapItemToForm(response.data.item));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load home bar item.",
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
        await authorizedRequest<ApiResponse<{ item: AdminHomeCategoryItem }>>(
          itemId ? `/admin/home-categories/${itemId}` : "/admin/home-categories",
          {
            method: itemId ? "PATCH" : "POST",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setForm(mapItemToForm(response.data.item));
      showAdminSnackbar({
        tone: "success",
        title: itemId ? "Home bar item updated" : "Home bar item created",
        body: `${response.data.item.label} was saved successfully.`,
      });
      setSuccessMessage(
        itemId
          ? "Home bar item updated successfully."
          : "Home bar item created successfully.",
      );

      if (!itemId) {
        router.replace(`/home-categories/${response.data.item.id}`);
      }
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: itemId ? "Home bar item update failed" : "Home bar item create failed",
        body:
          nextError instanceof Error
            ? nextError.message
            : "Unable to save home bar item.",
      });
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save home bar item.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(nextImage: string) {
    setForm((current) => ({ ...current, image: nextImage }));

    if (!itemId || !allowCatalogEdits) {
      return;
    }

    setImageSaving(true);
    setError(null);

    try {
      const nextForm = {
        ...form,
        image: nextImage,
      };

      const response =
        await authorizedRequest<ApiResponse<{ item: AdminHomeCategoryItem }>>(
          `/admin/home-categories/${itemId}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildPayload(nextForm)),
          },
        );

      setForm(mapItemToForm(response.data.item));
      showAdminSnackbar({
        tone: "success",
        title: "Home bar image updated",
        body: `${response.data.item.label} image was saved successfully.`,
      });
      setSuccessMessage("Home bar image updated successfully.");
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Home bar image update failed",
        body:
          nextError instanceof Error
            ? nextError.message
            : "Unable to save home bar image right now.",
      });
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save home bar image right now.",
      );
    } finally {
      setImageSaving(false);
    }
  }

  async function handleDelete() {
    if (!itemId || !allowCatalogEdits) {
      return;
    }

    const shouldDelete = window.confirm("Delete this home bar item?");

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      await authorizedRequest(`/admin/home-categories/${itemId}`, {
        method: "DELETE",
      });
      showAdminSnackbar({
        tone: "success",
        title: "Home bar item deleted",
        body: `${form.label || "This item"} was removed successfully.`,
      });
      router.replace("/home-categories");
    } catch (nextError) {
      showAdminSnackbar({
        tone: "error",
        title: "Home bar item delete failed",
        body:
          nextError instanceof Error
            ? nextError.message
            : "Unable to delete home bar item.",
      });
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete home bar item.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading home category editor..." />;
  }

  if (error && itemId && !form.label) {
    return <AdminErrorCard message={error} onRetry={loadItem} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Homepage Merchandising"
        title={itemId ? "Edit Home Bar Item" : "Create Home Bar Item"}
        description="Control each category chip shown below the home header, including its label, destination link, image, offer styling, gradient ring, and display order."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <CatalogMediaAssistant
          primaryImage={form.image}
          galleryImages={[]}
          entityLabel="home category"
        />

        <AdminPanel>
          <FormGrid>
            <FormField label="Item key">
              <input
                value={form.itemKey}
                onChange={(event) => setForm({ ...form, itemKey: event.target.value })}
                className={inputClassName()}
                placeholder="indoor"
              />
            </FormField>
            <FormField label="Label">
              <input
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                className={inputClassName()}
                placeholder="Indoor"
                required
              />
            </FormField>
            <FormField label="Href">
              <input
                value={form.href}
                onChange={(event) => setForm({ ...form, href: event.target.value })}
                className={inputClassName()}
                placeholder="/search?category=Indoor%20Plants"
                required
              />
            </FormField>
            <FormField label="Image URL">
              <MediaUploadInput
                label="Image URL"
                value={form.image}
                onChange={(nextImage) => void handleImageChange(nextImage)}
                entityType="home-category"
                entityId={itemId || form.itemKey || form.label || "home-category-draft"}
                slotKey="primary"
                purpose="home-category-image"
                allowEdits={allowCatalogEdits}
                placeholder="https://..."
                hint={
                  imageSaving
                    ? "Uploading and saving image..."
                    : "Upload a category chip image to S3 or paste a hosted URL."
                }
              />
            </FormField>
            <FormField label="Accent from">
              <input
                value={form.accentFrom}
                onChange={(event) =>
                  setForm({ ...form, accentFrom: event.target.value })
                }
                className={inputClassName()}
                placeholder="#d8c38f"
              />
            </FormField>
            <FormField label="Accent via">
              <input
                value={form.accentVia}
                onChange={(event) =>
                  setForm({ ...form, accentVia: event.target.value })
                }
                className={inputClassName()}
                placeholder="#f0d9a6"
              />
            </FormField>
            <FormField label="Accent to">
              <input
                value={form.accentTo}
                onChange={(event) => setForm({ ...form, accentTo: event.target.value })}
                className={inputClassName()}
                placeholder="#fbf3cf"
              />
            </FormField>
            <FormField label="Sort order">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                className={inputClassName()}
                placeholder="100"
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
                  checked={form.showOfferBadge}
                  onChange={(event) =>
                    setForm({ ...form, showOfferBadge: event.target.checked })
                  }
                />
                Show percentage offer badge instead of image
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
                Keep this item active on the storefront
              </label>
            </div>

            <div
              className="rounded-[1.2rem] border border-[var(--admin-line)] bg-white p-5"
            >
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Live preview
              </p>
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                <div
                  className="flex h-[5rem] w-[5rem] items-center justify-center rounded-full p-[2px]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${form.accentFrom}, ${form.accentVia}, ${form.accentTo})`,
                  }}
                >
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                    {form.showOfferBadge ? (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#ff9d8b_0%,#ff6f67_62%,#ff5a5a_100%)] text-[2.1rem] font-black text-white">
                        %
                      </div>
                    ) : form.image ? (
                      <Image
                        src={form.image}
                        alt={form.label || "Preview"}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-[var(--admin-muted)]">
                        No image
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#233d1d]">
                  {form.label || "Label"}
                </span>
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
              Your role can review the home category bar, but catalog-authorized staff should make changes.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || imageSaving || !allowCatalogEdits}
            >
              {saving
                ? "Saving..."
                : imageSaving
                  ? "Uploading..."
                  : itemId
                    ? "Save changes"
                    : "Create item"}
            </AdminActionButton>
            <Link
              href="/home-categories"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to home bar
            </Link>
            {itemId ? (
              <AdminActionButton
                type="button"
                tone="danger"
                onClick={handleDelete}
                disabled={deleting || !allowCatalogEdits}
              >
                {deleting ? "Deleting..." : "Delete item"}
              </AdminActionButton>
            ) : null}
          </div>
        </AdminPanel>
      </form>
    </div>
  );
}
