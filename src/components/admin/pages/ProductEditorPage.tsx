"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CatalogMediaAssistant from "@/components/admin/CatalogMediaAssistant";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ProductVideoShowcaseEditor, {
  type ProductVideoClipFormState,
} from "@/components/admin/ProductVideoShowcaseEditor";
import {
  AdminActionButton,
  AdminPanel,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName, textareaClassName } from "@/components/admin/Forms";
import type {
  AdminProduct,
  AdminProductDetailSection,
  AdminProductStockAlert,
  AdminProductVideoClip,
  AdminProductOption,
  AdminProductOptionGroup,
  ApiResponse,
} from "@/lib/admin-api";
import { splitCommaSeparatedValues, toCommaSeparatedValue } from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

type ProductEditorPageProps = {
  productId?: string;
};

type ProductFormState = {
  id: string;
  name: string;
  category: string;
  variety: string;
  containerSize: string;
  height: string;
  price: string;
  mrp: string;
  weight: string;
  offer: string;
  minOrderQuantity: string;
  stock: string;
  isOnTrend: boolean;
  isFeaturedLatest: boolean;
  packLabel: string;
  unit: string;
  badge: string;
  description: string;
  image: string;
  images: string;
  videoClips: ProductVideoClipFormState[];
  tags: string;
  optionGroups: ProductOptionGroupFormState[];
  detailSections: ProductDetailSectionFormState[];
};

type ProductOptionFormState = {
  key: string;
  label: string;
  value: string;
  unit: string;
  note: string;
  price: string;
  mrp: string;
  stock: string;
  packLabel: string;
  weight: string;
  isDefault: boolean;
  isDisabled: boolean;
};

type ProductOptionGroupFormState = {
  key: string;
  title: string;
  subtitle: string;
  guideLabel: string;
  options: ProductOptionFormState[];
};

type ProductDetailSectionFormState = {
  title: string;
  description: string;
};

const emptyForm: ProductFormState = {
  id: "",
  name: "",
  category: "",
  variety: "",
  containerSize: "",
  height: "",
  price: "",
  mrp: "",
  weight: "",
  offer: "",
  minOrderQuantity: "1",
  stock: "0",
  isOnTrend: false,
  isFeaturedLatest: false,
  packLabel: "",
  unit: "",
  badge: "",
  description: "",
  image: "",
  images: "",
  videoClips: [],
  tags: "",
  optionGroups: [],
  detailSections: [],
};

const emptyOption = (): ProductOptionFormState => ({
  key: "",
  label: "",
  value: "",
  unit: "",
  note: "",
  price: "",
  mrp: "",
  stock: "",
  packLabel: "",
  weight: "",
  isDefault: false,
  isDisabled: false,
});

const emptyOptionGroup = (): ProductOptionGroupFormState => ({
  key: "",
  title: "",
  subtitle: "Choose the option that fits your space best",
  guideLabel: "",
  options: [emptyOption()],
});

function mapOptionToForm(option: AdminProductOption): ProductOptionFormState {
  return {
    key: option.key || "",
    label: option.label || "",
    value: option.value === null || option.value === undefined ? "" : String(option.value),
    unit: option.unit || "",
    note: option.note || "",
    price: option.price === null || option.price === undefined ? "" : String(option.price),
    mrp: option.mrp === null || option.mrp === undefined ? "" : String(option.mrp),
    stock: option.stock === null || option.stock === undefined ? "" : String(option.stock),
    packLabel: option.packLabel || "",
    weight: option.weight === null || option.weight === undefined ? "" : String(option.weight),
    isDefault: Boolean(option.isDefault),
    isDisabled: Boolean(option.isDisabled),
  };
}

function mapOptionGroupToForm(group: AdminProductOptionGroup): ProductOptionGroupFormState {
  return {
    key: group.key || "",
    title: group.title || "",
    subtitle: group.subtitle || "",
    guideLabel: group.guideLabel || "",
    options: Array.isArray(group.options) && group.options.length
      ? group.options.map(mapOptionToForm)
      : [emptyOption()],
  };
}

function mapDetailSectionToForm(
  section: AdminProductDetailSection,
): ProductDetailSectionFormState {
  return {
    title: section.title || "",
    description: section.description || "",
  };
}

function mapProductToForm(product: AdminProduct): ProductFormState {
  return {
    id: product.id || "",
    name: product.name || "",
    category: product.category || "",
    variety: product.variety || "",
    containerSize: product.containerSize || "",
    height: product.height || "",
    price: String(product.price ?? ""),
    mrp: String(product.mrp ?? product.price ?? ""),
    weight: String(product.weight ?? ""),
    offer: product.offer || "",
    minOrderQuantity: String(product.minOrderQuantity ?? 1),
    stock: String(product.stock ?? 0),
    isOnTrend: Boolean(product.isOnTrend),
    isFeaturedLatest: Boolean(product.isFeaturedLatest),
    packLabel: product.packLabel || "",
    unit: product.unit || "",
    badge: product.badge || "",
    description: product.description || "",
    image: product.image || "",
    images: toCommaSeparatedValue(product.images || []),
    videoClips: Array.isArray(product.videoClips)
      ? product.videoClips.map((clip) => ({
          id: clip.id || "",
          title: clip.title || "",
          poster: clip.poster || "",
          src: clip.src || "",
          views: clip.views || "",
          products:
            clip.products === null || clip.products === undefined
              ? "1"
              : String(clip.products),
          isVideo: clip.isVideo ?? true,
        }))
      : [],
    tags: toCommaSeparatedValue(product.tags || []),
    optionGroups: Array.isArray(product.optionGroups)
      ? product.optionGroups.map(mapOptionGroupToForm)
      : [],
    detailSections: Array.isArray(product.detailSections)
      ? product.detailSections.map(mapDetailSectionToForm)
      : [],
  };
}

function normalizeVideoClipForPayload(
  clip: ProductVideoClipFormState,
): AdminProductVideoClip | null {
  const id = clip.id.trim();
  const title = clip.title.trim();
  const poster = clip.poster.trim();
  const src = clip.src.trim();
  const views = clip.views.trim();
  const parsedProducts = Math.floor(Number(clip.products));
  const products =
    Number.isFinite(parsedProducts) && parsedProducts >= 0
      ? parsedProducts
      : null;

  if (!id && !title && !poster && !src) {
    return null;
  }

  return {
    id: id || title || src || poster || "clip",
    title,
    poster,
    src,
    views,
    products,
    isVideo: clip.isVideo,
  };
}

function normalizeOptionForPayload(option: ProductOptionFormState): AdminProductOption | null {
  const label = option.label.trim();
  const unit = option.unit.trim();
  const parsedValue = Number(option.value);
  const value = Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
  const parsedPrice = Number(option.price);
  const price =
    Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null;
  const parsedMrp = Number(option.mrp);
  const mrp =
    Number.isFinite(parsedMrp) && parsedMrp >= 0
      ? Math.max(parsedMrp, price ?? 0)
      : price;
  const parsedStock = Number(option.stock);
  const stock =
    Number.isFinite(parsedStock) && parsedStock >= 0
      ? Math.floor(parsedStock)
      : null;
  const parsedWeight = Number(option.weight);
  const weight =
    Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : null;

  if (!label && value === null && !unit) {
    return null;
  }

  return {
    key: option.key.trim() || label || `${value ?? "option"}-${unit || "custom"}`,
    label,
    value,
    unit,
    note: option.note.trim(),
    price,
    mrp,
    stock,
    packLabel: option.packLabel.trim(),
    weight,
    isDefault: option.isDefault,
    isDisabled: option.isDisabled,
  };
}

function normalizeOptionGroupsForPayload(groups: ProductOptionGroupFormState[]) {
  return groups.flatMap((group) => {
    const options = group.options
      .map(normalizeOptionForPayload)
      .filter((option): option is AdminProductOption => Boolean(option));

    if (!group.title.trim() || !options.length) {
      return [];
    }

    const normalizedOptions = options.map((option) => ({
      ...option,
      isDefault: false,
    }));
    const explicitDefaultIndex = options.findIndex(
      (option) => option.isDefault && !option.isDisabled,
    );
    const fallbackDefaultIndex = options.findIndex((option) => !option.isDisabled);
    const selectedIndex =
      explicitDefaultIndex >= 0
        ? explicitDefaultIndex
        : fallbackDefaultIndex >= 0
          ? fallbackDefaultIndex
          : 0;

    if (normalizedOptions[selectedIndex]) {
      normalizedOptions[selectedIndex].isDefault = true;
    }

    return [
      {
        key: group.key.trim() || group.title.trim(),
        title: group.title.trim(),
        subtitle: group.subtitle.trim(),
        guideLabel: group.guideLabel.trim(),
        options: normalizedOptions,
      },
    ];
  });
}

function normalizeDetailSectionsForPayload(
  sections: ProductDetailSectionFormState[],
) {
  return sections.flatMap((section, index) => {
    const title = section.title.trim();
    const description = section.description.trim();

    if (!title || !description) {
      return [];
    }

    return [
      {
        title,
        description,
        sortOrder: index,
      },
    ];
  });
}

function buildPayload(form: ProductFormState) {
  return {
    id: form.id.trim() || undefined,
    name: form.name.trim(),
    category: form.category.trim(),
    variety: form.variety.trim(),
    containerSize: form.containerSize.trim(),
    height: form.height.trim(),
    price: Number(form.price || 0),
    mrp: Math.max(Number(form.mrp || 0), Number(form.price || 0)),
    weight: Number(form.weight || 0),
    offer: form.offer.trim(),
    minOrderQuantity: Number(form.minOrderQuantity || 1),
    stock: Math.max(0, Number(form.stock || 0)),
    isOnTrend: form.isOnTrend,
    isFeaturedLatest: form.isFeaturedLatest,
    packLabel: form.packLabel.trim(),
    unit: form.unit.trim(),
    badge: form.badge.trim(),
    description: form.description.trim(),
    image: form.image.trim(),
    images: splitCommaSeparatedValues(form.images),
    videoClips: form.videoClips
      .map(normalizeVideoClipForPayload)
      .filter((clip): clip is AdminProductVideoClip => Boolean(clip)),
    tags: splitCommaSeparatedValues(form.tags),
    optionGroups: normalizeOptionGroupsForPayload(form.optionGroups),
    detailSections: normalizeDetailSectionsForPayload(form.detailSections),
  };
}

export default function ProductEditorPage({ productId }: ProductEditorPageProps) {
  const router = useRouter();
  const { authorizedRequest, staff } = useAdminAuth();
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stockAlerts, setStockAlerts] = useState<AdminProductStockAlert[]>([]);
  const allowCatalogEdits = canManageCatalog(staff?.role);

  function updateOptionGroup(
    groupIndex: number,
    updates: Partial<ProductOptionGroupFormState>,
  ) {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, index) =>
        index === groupIndex ? { ...group, ...updates } : group,
      ),
    }));
  }

  function updateOption(
    groupIndex: number,
    optionIndex: number,
    updates: Partial<ProductOptionFormState>,
  ) {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        const nextOptions = group.options.map((option, currentOptionIndex) =>
          currentOptionIndex === optionIndex ? { ...option, ...updates } : option,
        );

        if (updates.isDefault) {
          return {
            ...group,
            options: nextOptions.map((option, currentOptionIndex) => ({
              ...option,
              isDefault: currentOptionIndex === optionIndex,
            })),
          };
        }

        return {
          ...group,
          options: nextOptions,
        };
      }),
    }));
  }

  function addOptionGroup() {
    setForm((current) => ({
      ...current,
      optionGroups: [...current.optionGroups, emptyOptionGroup()],
    }));
  }

  function removeOptionGroup(groupIndex: number) {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.filter((_, index) => index !== groupIndex),
    }));
  }

  function addOption(groupIndex: number) {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, index) =>
        index === groupIndex
          ? { ...group, options: [...group.options, emptyOption()] }
          : group,
      ),
    }));
  }

  function removeOption(groupIndex: number, optionIndex: number) {
    setForm((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        const nextOptions = group.options.filter((_, currentOptionIndex) =>
          currentOptionIndex !== optionIndex,
        );

        return {
          ...group,
          options: nextOptions.length ? nextOptions : [emptyOption()],
        };
      }),
    }));
  }

  function updateDetailSection(
    sectionIndex: number,
    updates: Partial<ProductDetailSectionFormState>,
  ) {
    setForm((current) => ({
      ...current,
      detailSections: current.detailSections.map((section, index) =>
        index === sectionIndex ? { ...section, ...updates } : section,
      ),
    }));
  }

  function addDetailSection() {
    setForm((current) => ({
      ...current,
      detailSections: [
        ...current.detailSections,
        {
          title: "",
          description: "",
        },
      ],
    }));
  }

  function removeDetailSection(sectionIndex: number) {
    setForm((current) => ({
      ...current,
      detailSections: current.detailSections.filter(
        (_, index) => index !== sectionIndex,
      ),
    }));
  }

  async function loadProduct() {
    if (!productId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
          `/admin/products/${productId}`,
        );
      setForm(mapProductToForm(response.data.product));
      setStockAlerts(response.data.product.stockAlerts || []);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load product details.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    async function syncProduct() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
            `/admin/products/${productId}`,
          );

        if (cancelled) {
          return;
        }

        setForm(mapProductToForm(response.data.product));
        setStockAlerts(response.data.product.stockAlerts || []);
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load product details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncProduct();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, productId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
          productId ? `/admin/products/${productId}` : "/admin/products",
          {
            method: productId ? "PATCH" : "POST",
            body: JSON.stringify(buildPayload(form)),
          },
        );

      setForm(mapProductToForm(response.data.product));
      setStockAlerts(response.data.product.stockAlerts || []);
      setSuccessMessage(
        productId
          ? "Product updated successfully."
          : "Product created successfully.",
      );

      if (!productId) {
        router.replace(`/products/${response.data.product.id}`);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId) {
      return;
    }

    const shouldDelete = window.confirm(
      "Delete this product from the catalog?",
    );

    if (!shouldDelete) {
      return;
    }

    setDeleting(true);

    try {
      await authorizedRequest(`/admin/products/${productId}`, {
        method: "DELETE",
      });
      router.replace("/products");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to delete product.",
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading product editor..." />;
  }

  if (error && productId && !form.name) {
    return <AdminErrorCard message={error} onRetry={loadProduct} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog Editor"
        title={productId ? "Edit Product" : "Create Product"}
        description="Set the storefront-facing product metadata used by the ecommerce site, including gallery, pricing, pack sizing, tags, and merchandising flags."
      />

      <form className="space-y-6" onSubmit={handleSubmit}>
        <CatalogMediaAssistant
          primaryImage={form.image}
          galleryImages={splitCommaSeparatedValues(form.images)}
          entityLabel="product"
          allowEdits={allowCatalogEdits}
          onPrimaryImageChange={(nextImage) =>
            setForm((current) => ({
              ...current,
              image: nextImage,
            }))
          }
          onGalleryImagesChange={(nextGalleryImages) =>
            setForm((current) => ({
              ...current,
              images: toCommaSeparatedValue(nextGalleryImages),
            }))
          }
        />

        <ProductVideoShowcaseEditor
          clips={form.videoClips}
          primaryImage={form.image}
          allowEdits={allowCatalogEdits}
          onChange={(nextVideoClips) =>
            setForm((current) => ({
              ...current,
              videoClips: nextVideoClips,
            }))
          }
        />

        <AdminPanel>
          <FormGrid>
            <FormField
              label="Internal product id"
              hint="Optional. If left empty, the server will generate one from the product name."
            >
              <input
                value={form.id}
                onChange={(event) => setForm({ ...form, id: event.target.value })}
                className={inputClassName()}
                placeholder="grass-carpet-premium"
              />
            </FormField>
            <FormField label="Name">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClassName()}
                placeholder="Premium Green Grass Carpet"
                required
              />
            </FormField>
            <FormField label="Category">
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={inputClassName()}
                placeholder="Grass"
                required
              />
            </FormField>
            <FormField label="Variety">
              <input
                value={form.variety}
                onChange={(event) => setForm({ ...form, variety: event.target.value })}
                className={inputClassName()}
                placeholder="Thai Variegated"
              />
            </FormField>
            <FormField label="Container size">
              <input
                value={form.containerSize}
                onChange={(event) =>
                  setForm({ ...form, containerSize: event.target.value })
                }
                className={inputClassName()}
                placeholder="6*6 Bags"
              />
            </FormField>
            <FormField label="Height">
              <input
                value={form.height}
                onChange={(event) => setForm({ ...form, height: event.target.value })}
                className={inputClassName()}
                placeholder="2 ft Height"
              />
            </FormField>
            <FormField label="Badge">
              <input
                value={form.badge}
                onChange={(event) => setForm({ ...form, badge: event.target.value })}
                className={inputClassName()}
                placeholder="Best Seller"
                required
              />
            </FormField>
            <FormField label="Rate">
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className={inputClassName()}
                placeholder="699"
                required
              />
            </FormField>
            <FormField label="MRP">
              <input
                type="number"
                min="0"
                value={form.mrp}
                onChange={(event) => setForm({ ...form, mrp: event.target.value })}
                className={inputClassName()}
                placeholder="899"
                required
              />
            </FormField>
            <FormField label="Weight">
              <input
                type="number"
                min="0"
                value={form.weight}
                onChange={(event) => setForm({ ...form, weight: event.target.value })}
                className={inputClassName()}
                placeholder="10"
                required
              />
            </FormField>
            <FormField label="Offer">
              <input
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
                className={inputClassName()}
                placeholder="Flat 20% off"
              />
            </FormField>
            <FormField label="Min Qty">
              <input
                type="number"
                min="1"
                value={form.minOrderQuantity}
                onChange={(event) =>
                  setForm({ ...form, minOrderQuantity: event.target.value })
                }
                className={inputClassName()}
                required
              />
            </FormField>
            <FormField label="Stock available">
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => setForm({ ...form, stock: event.target.value })}
                className={inputClassName()}
                required
              />
            </FormField>
            <FormField label="Pack label">
              <input
                value={form.packLabel}
                onChange={(event) => setForm({ ...form, packLabel: event.target.value })}
                className={inputClassName()}
                placeholder="Per roll"
                required
              />
            </FormField>
            <FormField label="Unit">
              <input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                className={inputClassName()}
                placeholder="sqft"
                required
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
            <FormField
              label="Gallery images"
              hint="Comma-separated image URLs. The server will normalize duplicates."
            >
              <input
                value={form.images}
                onChange={(event) => setForm({ ...form, images: event.target.value })}
                className={inputClassName()}
                placeholder="https://..., https://..."
              />
            </FormField>
          </FormGrid>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField
              label="Tags"
              hint="Comma-separated search and merchandising tags."
            >
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                className={inputClassName()}
                placeholder="garden, outdoor, premium"
              />
            </FormField>

            <div className="rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                Merchandising flags
              </p>
              <label className="mt-4 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isOnTrend}
                  onChange={(event) =>
                    setForm({ ...form, isOnTrend: event.target.checked })
                  }
                />
                Show as trending product
              </label>
              <label className="mt-3 flex items-center gap-3 text-sm text-[var(--admin-ink)]">
                <input
                  type="checkbox"
                  checked={form.isFeaturedLatest}
                  onChange={(event) =>
                    setForm({ ...form, isFeaturedLatest: event.target.checked })
                  }
                />
                Feature in latest sections
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
                placeholder="Describe the product for the storefront."
                required
              />
            </FormField>
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold text-[var(--admin-ink)]">
                  Product detail sections
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  Add storefront sections like Product Description, Maintenance Guide, or any custom title with editable text.
                </p>
              </div>
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={addDetailSection}
                disabled={!allowCatalogEdits}
              >
                Add section
              </AdminActionButton>
            </div>

            {form.detailSections.length ? (
              <div className="mt-5 space-y-4">
                {form.detailSections.map((section, sectionIndex) => (
                  <div
                    key={`detail-section-${sectionIndex}`}
                    className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <FormField label="Section title">
                        <input
                          value={section.title}
                          onChange={(event) =>
                            updateDetailSection(sectionIndex, {
                              title: event.target.value,
                            })
                          }
                          className={inputClassName()}
                          placeholder="Maintenance Guide"
                        />
                      </FormField>
                      <FormField label="Section description">
                        <textarea
                          value={section.description}
                          onChange={(event) =>
                            updateDetailSection(sectionIndex, {
                              description: event.target.value,
                            })
                          }
                          className={textareaClassName()}
                          placeholder="Add the storefront text for this section."
                          rows={4}
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <AdminActionButton
                        type="button"
                        tone="danger"
                        onClick={() => removeDetailSection(sectionIndex)}
                        disabled={!allowCatalogEdits}
                      >
                        Remove section
                      </AdminActionButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--admin-muted)]">
                No product detail sections added yet.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold text-[var(--admin-ink)]">
                  Notify requests
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  Customers who asked to be notified when this out-of-stock
                  product becomes available again.
                </p>
              </div>
              <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--admin-ink)]">
                {stockAlerts.length}
              </span>
            </div>

            {stockAlerts.length ? (
              <div className="mt-5 space-y-3">
                {stockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--admin-ink)]">
                          {alert.customer?.fullName || "Interested customer"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--admin-muted)]">
                          {alert.customer?.email || "No email"}
                        </p>
                        {alert.customer?.phoneNumber ? (
                          <p className="mt-1 text-sm text-[var(--admin-muted)]">
                            {alert.customer.phoneNumber}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-[var(--admin-muted)]">
                        <p>
                          Requested{" "}
                          {alert.createdAt
                            ? new Date(alert.createdAt).toLocaleString()
                            : "recently"}
                        </p>
                        {alert.customer?.city ? (
                          <p className="mt-1">{alert.customer.city}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--admin-muted)]">
                No customers have requested a stock notification for this
                product yet.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold text-[var(--admin-ink)]">
                  Selectable option groups
                </p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  Add dynamic size or coverage choices like `12 inch`, `30 cm`, `3 gallon`, or `100 sq ft`.
                </p>
              </div>
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={addOptionGroup}
                disabled={!allowCatalogEdits}
              >
                Add option group
              </AdminActionButton>
            </div>

            {form.optionGroups.length ? (
              <div className="mt-5 space-y-5">
                {form.optionGroups.map((group, groupIndex) => (
                  <div
                    key={`option-group-${groupIndex}`}
                    className="rounded-[1.1rem] border border-[var(--admin-line)] bg-white p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FormField label="Group title">
                        <input
                          value={group.title}
                          onChange={(event) =>
                            updateOptionGroup(groupIndex, { title: event.target.value })
                          }
                          className={inputClassName()}
                          placeholder="Select Coverage"
                        />
                      </FormField>
                      <FormField label="Group key">
                        <input
                          value={group.key}
                          onChange={(event) =>
                            updateOptionGroup(groupIndex, { key: event.target.value })
                          }
                          className={inputClassName()}
                          placeholder="coverage"
                        />
                      </FormField>
                      <FormField label="Subtitle">
                        <input
                          value={group.subtitle}
                          onChange={(event) =>
                            updateOptionGroup(groupIndex, { subtitle: event.target.value })
                          }
                          className={inputClassName()}
                          placeholder="Choose the option that fits your space best"
                        />
                      </FormField>
                      <FormField label="Guide label">
                        <input
                          value={group.guideLabel}
                          onChange={(event) =>
                            updateOptionGroup(groupIndex, { guideLabel: event.target.value })
                          }
                          className={inputClassName()}
                          placeholder="Coverage guide"
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 space-y-3">
                      {group.options.map((option, optionIndex) => (
                        <div
                          key={`option-${groupIndex}-${optionIndex}`}
                          className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] p-4"
                        >
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                            <FormField label="Label">
                              <input
                                value={option.label}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    label: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="M or 100 sq ft"
                              />
                            </FormField>
                            <FormField label="Value">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={option.value}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    value: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="100"
                              />
                            </FormField>
                            <FormField label="Unit">
                              <input
                                value={option.unit}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    unit: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="sq ft / cm / inch / gallon"
                              />
                            </FormField>
                            <FormField label="Note">
                              <input
                                value={option.note}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    note: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="Popular or Low stock"
                              />
                            </FormField>
                            <FormField label="Option key">
                              <input
                                value={option.key}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    key: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="100-sq-ft"
                              />
                            </FormField>
                            <FormField label="Option rate">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={option.price}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    price: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="699"
                              />
                            </FormField>
                            <FormField label="Option MRP">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={option.mrp}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    mrp: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="899"
                              />
                            </FormField>
                            <FormField label="Option stock">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={option.stock}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    stock: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="12"
                              />
                            </FormField>
                            <FormField label="Pack label override">
                              <input
                                value={option.packLabel}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    packLabel: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="Pack of 100 sq ft"
                              />
                            </FormField>
                            <FormField label="Weight override">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={option.weight}
                                onChange={(event) =>
                                  updateOption(groupIndex, optionIndex, {
                                    weight: event.target.value,
                                  })
                                }
                                className={inputClassName()}
                                placeholder="10"
                              />
                            </FormField>
                            <div className="flex flex-col justify-end gap-3">
                              <label className="flex items-center gap-2 text-sm font-medium text-[var(--admin-ink)]">
                                <input
                                  type="checkbox"
                                  checked={option.isDefault}
                                  onChange={(event) =>
                                    updateOption(groupIndex, optionIndex, {
                                      isDefault: event.target.checked,
                                    })
                                  }
                                />
                                Default
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium text-[var(--admin-ink)]">
                                <input
                                  type="checkbox"
                                  checked={option.isDisabled}
                                  onChange={(event) =>
                                    updateOption(groupIndex, optionIndex, {
                                      isDisabled: event.target.checked,
                                    })
                                  }
                                />
                                Disabled
                              </label>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-[var(--admin-muted)]">
                              Leave label empty if you want the storefront to generate it from value + unit.
                            </p>
                            <AdminActionButton
                              type="button"
                              tone="danger"
                              onClick={() => removeOption(groupIndex, optionIndex)}
                              disabled={!allowCatalogEdits}
                            >
                              Remove option
                            </AdminActionButton>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <AdminActionButton
                        type="button"
                        tone="secondary"
                        onClick={() => addOption(groupIndex)}
                        disabled={!allowCatalogEdits}
                      >
                        Add option
                      </AdminActionButton>
                      <AdminActionButton
                        type="button"
                        tone="danger"
                        onClick={() => removeOptionGroup(groupIndex)}
                        disabled={!allowCatalogEdits}
                      >
                        Remove group
                      </AdminActionButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--admin-muted)]">
                No selectable size or coverage groups added yet.
              </p>
            )}
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
              Your role can view product metadata, but catalog changes should be completed by catalog, manager, admin, or owner staff.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminActionButton
              type="submit"
              tone="primary"
              disabled={saving || !allowCatalogEdits}
            >
              {saving ? "Saving..." : productId ? "Save changes" : "Create product"}
            </AdminActionButton>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to products
            </Link>
            {productId ? (
              <AdminActionButton
                type="button"
                tone="danger"
                onClick={handleDelete}
                disabled={deleting || !allowCatalogEdits}
              >
                {deleting ? "Deleting..." : "Delete product"}
              </AdminActionButton>
            ) : null}
          </div>
        </AdminPanel>
      </form>
    </div>
  );
}
