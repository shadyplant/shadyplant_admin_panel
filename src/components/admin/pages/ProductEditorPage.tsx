"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import {
  AdminActionButton,
  AdminPanel,
} from "@/components/admin/AdminUi";
import { FormField, inputClassName, textareaClassName } from "@/components/admin/Forms";
import type {
  AdminProduct,
  AdminProductDetailSection,
  AdminMediaUploadSessionResponse,
  AdminProductStockAlert,
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
  images: string[];
  usesImages: string[];
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

type ConfirmationModalState =
  | {
      kind: "detail";
      sectionIndex: number;
    }
  | {
      kind: "delete";
    }
  | null;

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
  images: [],
  usesImages: [],
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

function isValidRemoteImageUrl(value: string) {
  const nextValue = value.trim();

  if (!nextValue) {
    return false;
  }

  try {
    const parsed = new URL(nextValue);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
    images: Array.isArray(product.images)
      ? product.images.map((image) => image.trim()).filter(Boolean)
      : [],
    usesImages: Array.isArray(product.usesImages)
      ? product.usesImages.map((image) => image.trim()).filter(Boolean)
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
    images: form.images.map((image) => image.trim()).filter(Boolean),
    usesImages: form.usesImages.map((image) => image.trim()).filter(Boolean),
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
  const [imageModalSection, setImageModalSection] = useState<"product" | "uses" | null>(null);
  const [selectedImageSlotIndex, setSelectedImageSlotIndex] = useState<number | null>(0);
  const [draftImageUrl, setDraftImageUrl] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  const [imageUploadPercent, setImageUploadPercent] = useState<number | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadResetTimerRef = useRef<number | null>(null);
  const allowCatalogEdits = canManageCatalog(staff?.role);
  const primaryImage = isValidRemoteImageUrl(form.image.trim()) ? form.image.trim() : "";
  const productGalleryImages = form.images
    .map((image) => image.trim())
    .filter((image) => isValidRemoteImageUrl(image));
  const usesViewImages = form.usesImages
    .map((image) => image.trim())
    .filter((image) => isValidRemoteImageUrl(image));
  const productPreviewImages = [primaryImage, ...productGalleryImages].filter(Boolean).slice(0, 4);
  const usesPreviewImages = usesViewImages.slice(0, 3);
  const isImageModalOpen = imageModalSection !== null;
  const imageModalTitle = imageModalSection === "product" ? "Product" : "Uses View";
  const imageModalSlots = imageModalSection ? getImageModalSlots(imageModalSection) : [];
  const activeImageSlotIndex =
    selectedImageSlotIndex === null
      ? null
      : imageModalSlots.length
        ? Math.min(selectedImageSlotIndex, imageModalSlots.length - 1)
        : null;
  const activeImageSlot =
    activeImageSlotIndex === null ? null : imageModalSlots[activeImageSlotIndex] ?? null;
  const activeImagePreviewUrl = pendingImagePreviewUrl || activeImageSlot?.value || "";
  const isDraftUrlValid = isValidRemoteImageUrl(draftImageUrl);
  const activeImageSlotPosition = activeImageSlotIndex === null ? 0 : activeImageSlotIndex + 1;

  useEffect(() => {
    return () => {
      if (uploadResetTimerRef.current !== null) {
        window.clearTimeout(uploadResetTimerRef.current);
      }

      if (pendingImagePreviewUrl) {
        window.URL.revokeObjectURL(pendingImagePreviewUrl);
      }
    };
  }, [pendingImagePreviewUrl]);

  function getImageModalSlots(section: "product" | "uses") {
    if (section === "product") {
      return [
        {
          label: "Primary image",
          value: isValidRemoteImageUrl(form.image.trim()) ? form.image.trim() : "",
          index: 0,
        },
        ...form.images.map((image, index) => ({
          label: `Gallery ${index + 1}`,
          value: isValidRemoteImageUrl(image.trim()) ? image.trim() : "",
          index: index + 1,
        })),
      ];
    }

    return form.usesImages.map((image, index) => ({
      label: `Uses image ${index + 1}`,
      value: isValidRemoteImageUrl(image.trim()) ? image.trim() : "",
      index,
    }));
  }

  function removeImageModalSlot(section: "product" | "uses", slotIndex: number) {
    console.log("[ProductEditorPage] removeImageModalSlot", {
      section,
      slotIndex,
      productId,
      imageCount: form.images.length,
      usesImageCount: form.usesImages.length,
    });

    const nextImages =
      section === "product"
        ? form.images.filter((_, index) => index !== slotIndex - 1)
        : form.usesImages.filter((_, index) => index !== slotIndex);

    const nextForm =
      section === "product"
        ? slotIndex === 0
          ? { ...form, image: "" }
          : {
              ...form,
              images: nextImages.length > 0 ? nextImages : [""],
            }
        : {
            ...form,
            usesImages: nextImages.length > 0 ? nextImages : [""],
          };

    setForm(nextForm);
    void persistProductImages(nextForm);

    setSelectedImageSlotIndex((current) => Math.max(0, current - (slotIndex <= current ? 1 : 0)));
  }

  function selectImageModalSlot(section: "product" | "uses", slotIndex: number) {
    console.log("[ProductEditorPage] selectImageModalSlot", {
      section,
      slotIndex,
      productId,
      slotCount: getImageModalSlots(section).length,
    });

    const slots = getImageModalSlots(section);
    const nextIndex = Math.max(0, Math.min(slotIndex, Math.max(slots.length - 1, 0)));
    const nextSlot = slots[nextIndex] ?? null;

    if (selectedImageSlotIndex === nextIndex && imageModalSection === section) {
      setSelectedImageSlotIndex(null);
      setDraftImageUrl("");
      setImageUploadError(null);
      setImageUploadStatus(null);
      setImageUploadPercent(null);
      clearPendingImageFile();
      return;
    }

    setSelectedImageSlotIndex(nextIndex);
    setDraftImageUrl(nextSlot?.value || "");
    setImageUploadError(null);
    setImageUploadStatus(null);
    setImageUploadPercent(null);
    clearPendingImageFile();
  }

  function getImageUploadPurpose() {
    if (imageModalSection === "product") {
      return activeImageSlotIndex === 0 ? "product-image" : "product-gallery-image";
    }

    return "product-uses-view-image";
  }

  function buildProductImagePayload(nextForm: ProductFormState) {
    return {
      image: nextForm.image.trim(),
      images: nextForm.images.map((image) => image.trim()).filter(Boolean),
      usesImages: nextForm.usesImages.map((image) => image.trim()).filter(Boolean),
    };
  }

  async function persistProductImages(nextForm: ProductFormState) {
    if (!productId || !allowCatalogEdits) {
      console.log("[ProductEditorPage] persistProductImages skipped", {
        productId,
        allowCatalogEdits,
        imageCount: nextForm.images.length,
        usesImageCount: nextForm.usesImages.length,
      });
      return;
    }

    try {
      const payload = buildProductImagePayload(nextForm);
      console.log("[ProductEditorPage] persistProductImages request", {
        productId,
        payload,
      });

      const response = await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
        `/admin/products/${productId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      const nextProduct = response.data.product;
      console.log("[ProductEditorPage] persistProductImages response", {
        productId,
        image: nextProduct.image || "",
        images: nextProduct.images,
        usesImages: nextProduct.usesImages,
      });
      setForm((current) => ({
        ...current,
        image: nextProduct.image?.trim() || nextForm.image.trim() || "",
        images: Array.isArray(nextProduct.images)
          ? nextProduct.images.map((image) => image.trim()).filter(Boolean).length > 0
            ? nextProduct.images.map((image) => image.trim()).filter(Boolean)
            : nextForm.images.map((image) => image.trim()).filter(Boolean)
          : nextForm.images.map((image) => image.trim()).filter(Boolean),
        usesImages: Array.isArray(nextProduct.usesImages)
          ? nextProduct.usesImages.map((image) => image.trim()).filter(Boolean).length > 0
            ? nextProduct.usesImages.map((image) => image.trim()).filter(Boolean)
            : nextForm.usesImages.map((image) => image.trim()).filter(Boolean)
          : nextForm.usesImages.map((image) => image.trim()).filter(Boolean),
      }));
      setStockAlerts(response.data.product.stockAlerts || []);
    } catch (nextError) {
      console.error("[ProductEditorPage] persistProductImages failed", nextError);
      setImageUploadError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save product image changes right now.",
      );
    }
  }

  function clearPendingImageFile() {
    setPendingImageFile(null);

    if (pendingImagePreviewUrl) {
      window.URL.revokeObjectURL(pendingImagePreviewUrl);
    }

    setPendingImagePreviewUrl(null);
  }

  function handleImageFileSelection(file: File | null) {
    setImageUploadError(null);
    setImageUploadStatus(null);

    clearPendingImageFile();

    if (!file) {
      return;
    }

    const previewUrl = window.URL.createObjectURL(file);
    setPendingImageFile(file);
    setPendingImagePreviewUrl(previewUrl);
  }

  function applyImageUrl() {
    if (!imageModalSection) {
      return;
    }

    const nextUrl = draftImageUrl.trim();
    console.log("[ProductEditorPage] applyImageUrl", {
      section: imageModalSection,
      activeImageSlotIndex,
      draftImageUrl: nextUrl,
      productId,
    });

    if (!nextUrl) {
      setImageUploadError("Enter an image URL.");
      return;
    }

    if (!isValidRemoteImageUrl(nextUrl)) {
      setImageUploadError("Enter a valid http or https image URL.");
      return;
    }

    const nextForm =
      activeImageSlotIndex === null
        ? imageModalSection === "product"
          ? { ...form, images: [...form.images, nextUrl] }
          : { ...form, usesImages: [...form.usesImages, nextUrl] }
        : imageModalSection === "product"
          ? activeImageSlotIndex === 0
            ? { ...form, image: nextUrl }
            : {
                ...form,
                images: (() => {
                  const nextImages = form.images.length ? [...form.images] : [""];
                  nextImages[activeImageSlotIndex - 1] = nextUrl;
                  return nextImages;
                })(),
              }
          : {
              ...form,
              usesImages: (() => {
                const nextUsesImages = form.usesImages.length ? [...form.usesImages] : [""];
                nextUsesImages[activeImageSlotIndex] = nextUrl;
                return nextUsesImages;
              })(),
            };

    setForm(nextForm);
    void persistProductImages(nextForm);

    if (activeImageSlotIndex === null) {
      setSelectedImageSlotIndex(imageModalSlots.length);
    }

    setDraftImageUrl("");
    setImageUploadError(null);
    setImageUploadStatus(null);
  }

  async function uploadPendingImageFile() {
    if (!imageModalSection || !pendingImageFile || !allowCatalogEdits) {
      console.log("[ProductEditorPage] uploadPendingImageFile skipped", {
        section: imageModalSection,
        hasFile: Boolean(pendingImageFile),
        allowCatalogEdits,
        productId,
      });
      return;
    }

    console.log("[ProductEditorPage] uploadPendingImageFile start", {
      section: imageModalSection,
      activeImageSlotIndex,
      productId,
      fileName: pendingImageFile.name,
    });

    setIsImageUploading(true);
    setImageUploadPercent(0);
    setImageUploadStatus("Requesting upload URL...");
    setImageUploadError(null);

    try {
      const sessionResponse = await authorizedRequest<
        ApiResponse<AdminMediaUploadSessionResponse>
      >("/admin/media/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          purpose: getImageUploadPurpose(),
          entityType: "product",
          entityId: form.id || productId || form.name || "product-draft",
          slotKey: `${imageModalSection}-slot-${
            activeImageSlotIndex === null ? imageModalSlots.length + 1 : activeImageSlotPosition
          }`,
          fileName: pendingImageFile.name,
          contentType: pendingImageFile.type || "image/jpeg",
          byteSize: pendingImageFile.size,
        }),
      });

      const session = sessionResponse.data.session;
      const upload = sessionResponse.data;

      console.log("[ProductEditorPage] uploadPendingImageFile presign", {
        sessionId: session.id,
        slotKey: session.slotKey,
        purpose: session.purpose,
        publicUrl: upload.publicUrl,
      });

      setImageUploadStatus("Uploading image...");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open(upload.method, upload.signedUrl, true);
        Object.entries(upload.headers || {}).forEach(([header, headerValue]) => {
          xhr.setRequestHeader(header, headerValue);
        });

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            return;
          }

          setImageUploadPercent(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }

          reject(
            new Error(
              `Upload failed with status ${xhr.status}. Please try again.`,
            ),
          );
        };

        xhr.onerror = () => {
          reject(new Error("Unable to upload image to S3."));
        };

        xhr.send(pendingImageFile);
      });

      setImageUploadStatus("Finalizing upload...");
      await authorizedRequest<ApiResponse<{ session: unknown }>>(
        `/admin/media/uploads/${session.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ publicUrl: upload.publicUrl }),
        },
      );

      const nextForm =
        activeImageSlotIndex === null
          ? imageModalSection === "product"
            ? { ...form, images: [...form.images, upload.publicUrl] }
            : { ...form, usesImages: [...form.usesImages, upload.publicUrl] }
          : imageModalSection === "product"
            ? activeImageSlotIndex === 0
              ? { ...form, image: upload.publicUrl }
              : {
                  ...form,
                  images: (() => {
                    const nextImages = form.images.length ? [...form.images] : [""];
                    nextImages[activeImageSlotIndex - 1] = upload.publicUrl;
                    return nextImages;
                  })(),
                }
            : {
                ...form,
                usesImages: (() => {
                  const nextUsesImages = form.usesImages.length ? [...form.usesImages] : [""];
                  nextUsesImages[activeImageSlotIndex] = upload.publicUrl;
                  return nextUsesImages;
                })(),
              };

      console.log("[ProductEditorPage] uploadPendingImageFile nextForm", {
        imageCount: nextForm.images.length,
        usesImageCount: nextForm.usesImages.length,
        activeImageSlotIndex,
      });

      setForm(nextForm);
      void persistProductImages(nextForm);

      if (activeImageSlotIndex === null) {
        setSelectedImageSlotIndex(imageModalSlots.length);
      }

      setDraftImageUrl("");
      setImageUploadPercent(null);
      setImageUploadStatus(null);
      clearPendingImageFile();
    } catch (nextError) {
      console.error("[ProductEditorPage] uploadPendingImageFile failed", nextError);
      setImageUploadError(
        nextError instanceof Error ? nextError.message : "Unable to upload image right now.",
      );
    } finally {
      setIsImageUploading(false);
      if (uploadResetTimerRef.current !== null) {
        window.clearTimeout(uploadResetTimerRef.current);
      }

      uploadResetTimerRef.current = window.setTimeout(() => {
        setImageUploadPercent(null);
      }, 1200);
    }
  }

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

  function openImageModal(section: "product" | "uses") {
    console.log("[ProductEditorPage] openImageModal", {
      section,
      productId,
      productImageCount: form.images.length,
      usesImageCount: form.usesImages.length,
    });

    setImageModalSection(section);
    selectImageModalSlot(section, 0);
  }

  function closeImageModal() {
    setImageModalSection(null);
  }

  function removeDetailSection(sectionIndex: number) {
    setForm((current) => ({
      ...current,
      detailSections: current.detailSections.filter(
        (_, index) => index !== sectionIndex,
      ),
    }));
  }

  function requestDetailSectionRemoval(sectionIndex: number) {
    setConfirmationModal({ kind: "detail", sectionIndex });
  }

  function requestProductDelete() {
    setConfirmationModal({ kind: "delete" });
  }

  function closeConfirmationModal() {
    setConfirmationModal(null);
  }

  async function confirmDestructiveAction() {
    if (!confirmationModal) {
      return;
    }

    const currentAction = confirmationModal;
    setConfirmationModal(null);

    if (currentAction.kind === "detail") {
      removeDetailSection(currentAction.sectionIndex);
      return;
    }

    await handleDelete();
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--admin-muted)]">
            Catalog Editor
          </p>
          <h1 className="mt-1 text-[2rem] font-medium tracking-[-0.04em] text-[var(--admin-ink)]">
            {productId ? "Edit Product" : "Create Product"}
          </h1>

        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AdminActionButton
            type="submit"
            form="product-editor-form"
            tone="primary"
            disabled={saving || !allowCatalogEdits}
          >
            {saving ? "Saving..." : productId ? "Save Changes" : "Create Product"}
          </AdminActionButton>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
          >
            Back to products
          </Link>
        </div>
      </div>

      {(error || successMessage) && (
        <div
          className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${
            error
              ? "border border-[#f1c7c3] bg-[#fff6f4] text-[#a73d31]"
              : "border border-[#cfe2c8] bg-[#f4fbf1] text-[#256233]"
          }`}
        >
          {error || successMessage}
        </div>
      )}

      {!allowCatalogEdits ? (
        <div className="rounded-[1rem]  bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
          Your role can view product metadata, but catalog changes should be completed by
          catalog, manager, admin, or owner staff.
        </div>
      ) : null}

      <form id="product-editor-form" className="space-y-6" onSubmit={handleSubmit}>
        <AdminPanel className="overflow-hidden bg-white p-0">
          <div className="border-b border-[var(--admin-line)] px-4 py-3 text-center">
            <p className="text-base font-medium text-[var(--admin-ink)]">Product Images</p>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-[var(--admin-line)] px-4 py-4 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-medium text-[var(--admin-ink)]">Product</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openImageModal("product")}
                    disabled={!allowCatalogEdits}
                    className="text-sm font-medium text-[var(--admin-ink)] transition hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => openImageModal("product")}
                    disabled={!allowCatalogEdits}
                    className="text-sm font-medium text-[var(--admin-ink)] transition hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => {
                  const image = productPreviewImages[index];
                  const isSeeMore = index === 3;

                  return (
                    <div
                      key={`product-preview-${index}`}
                      className={`relative aspect-square overflow-hidden rounded-[0.85rem]${
                        isSeeMore
                          ? "bg-[#e5f3e7]"
                          : "bg-[var(--admin-chip)]"
                      }`}
                    >
                      {image && !isSeeMore ? (
                        <Image
                          src={image}
                          alt={`Product preview ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="120px"
                        />
                      ) : isSeeMore ? (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-[var(--admin-ink)]">
                          See more
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--admin-muted)]">
                          Empty
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-medium text-[var(--admin-ink)]">Uses View</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openImageModal("uses")}
                    disabled={!allowCatalogEdits}
                    className="text-sm font-medium text-[var(--admin-ink)] transition hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => openImageModal("uses")}
                    disabled={!allowCatalogEdits}
                    className="text-sm font-medium text-[var(--admin-ink)] transition hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => {
                  const image = usesPreviewImages[index];
                  const isSeeMore = index === 3;

                  return (
                    <div
                      key={`uses-preview-${index}`}
                      className={`relative aspect-square overflow-hidden rounded-[0.85rem] ${
                        isSeeMore
                          ? "bg-[var(--admin-chip)]"
                          : " bg-[var(--admin-chip)]"
                      }`}
                    >
                      {image && !isSeeMore ? (
                        <Image
                          src={image}
                          alt={`Uses view preview ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="120px"
                        />
                      ) : isSeeMore ? (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-[var(--admin-ink)]">
                          See more
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--admin-muted)]">
                          Empty
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className=" bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--admin-muted)]">Stock</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                Keep the available quantity accurate for the storefront.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,16rem)_max-content] md:items-end md:justify-items-start">
            <FormField label="Available stock">
              <div className="max-w-[16rem]">
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => setForm({ ...form, stock: event.target.value })}
                  className={inputClassName()}
                  required
                />
              </div>
            </FormField>
            <AdminActionButton
              type="submit"
              tone="primary"
              className="w-fit whitespace-nowrap px-4 md:px-4 md:justify-self-start"
            >
              Adjust Stock
            </AdminActionButton>
          </div>
        </AdminPanel>

        <AdminPanel className=" bg-white p-5">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <p className="text-sm font-medium text-[var(--admin-muted)]">Identify</p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
              Product Details
            </h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Internal product id (optional)"
              hint=""
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
            <FormField label="Variety">
              <input
                value={form.variety}
                onChange={(event) => setForm({ ...form, variety: event.target.value })}
                className={inputClassName()}
                placeholder="Thai Variegated"
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
            <FormField label="Tags (Comma-separated search and merchandising tags.)" hint="">
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
                className={inputClassName()}
                placeholder="garden, outdoor, premium"
              />
            </FormField>
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
        </AdminPanel>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminPanel className=" bg-white p-5">
            <div className="border-b border-[var(--admin-line)] pb-4">
              <p className="text-sm font-medium text-[var(--admin-muted)]">Pricing</p>
              <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
                Price Details
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
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
              <FormField label="Sale price">
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
              <FormField label="Offer / discount">
                <input
                  value={form.offer}
                  onChange={(event) => setForm({ ...form, offer: event.target.value })}
                  className={inputClassName()}
                  placeholder="Flat 20% off"
                />
              </FormField>
            </div>
          </AdminPanel>

          <AdminPanel className=" bg-white p-5">
            <div className="border-b border-[var(--admin-line)] pb-4">
              <p className="text-sm font-medium text-[var(--admin-muted)]">Properties</p>
              <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
                Measurements
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Height">
                <input
                  value={form.height}
                  onChange={(event) => setForm({ ...form, height: event.target.value })}
                  className={inputClassName()}
                  placeholder="2 ft Height"
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
              <FormField label="Pack label">
                <input
                  value={form.packLabel}
                  onChange={(event) => setForm({ ...form, packLabel: event.target.value })}
                  className={inputClassName()}
                  placeholder="Per roll"
                  required
                />
              </FormField>
              <FormField label="Unit label">
                <input
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  className={inputClassName()}
                  placeholder="sqft"
                  required
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
              <FormField label="Min order qty">
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
            </div>
          </AdminPanel>
        </div>

        <AdminPanel className=" bg-white p-5">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <p className="text-sm font-medium text-[var(--admin-muted)]">
              Merchandising flags
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
              Visibility
            </h2>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:gap-10">
            <label className="flex items-center gap-3 text-sm text-[var(--admin-ink)]">
              <input
                type="checkbox"
                checked={form.isOnTrend}
                onChange={(event) =>
                  setForm({ ...form, isOnTrend: event.target.checked })
                }
              />
              Show as trending product
            </label>
            <label className="flex items-center gap-3 text-sm text-[var(--admin-ink)]">
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
        </AdminPanel>

        <AdminPanel className=" bg-white p-5">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <p className="text-sm font-medium text-[var(--admin-muted)]">
              Product details / Maintenance
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
              Detail Sections
            </h2>
          </div>

          {form.detailSections.length ? (
            <div className="mt-5 space-y-4">
              {form.detailSections.map((section, sectionIndex) => (
                <div
                  key={`detail-section-${sectionIndex}`}
                  className="rounded-[1rem]  bg-[var(--admin-chip)] p-4"
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
                            onClick={() => requestDetailSectionRemoval(sectionIndex)}
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

          <div className="mt-5 flex justify-start">
            <AdminActionButton
              type="button"
              tone="secondary"
              onClick={addDetailSection}
              disabled={!allowCatalogEdits}
            >
              Add section
            </AdminActionButton>
          </div>
        </AdminPanel>

        <AdminPanel className=" bg-white p-5">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <p className="text-sm font-medium text-[var(--admin-muted)]">
              Selectable option groups
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
              Variants
            </h2>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--admin-muted)]">
              Add dynamic size or coverage choices like `12 inch`, `30 cm`, `3 gallon`, or
              `100 sq ft`.
            </p>
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
                  className="rounded-[1.1rem]  bg-[var(--admin-chip)] p-4"
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
                        className="rounded-[1rem]  bg-white p-4"
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
                            Leave label empty if you want the storefront to generate it from
                            value + unit.
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
        </AdminPanel>

        <AdminPanel className=" bg-white p-5">
          <div className="border-b border-[var(--admin-line)] pb-4">
            <p className="text-sm font-medium text-[var(--admin-muted)]">Notify requests</p>
            <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--admin-ink)]">
              Waitlist
            </h2>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--admin-muted)]">
              Customers who asked to be notified when this out-of-stock product becomes
              available again.
            </p>
            <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-[var(--admin-chip)] px-3 py-1 text-sm font-semibold text-[var(--admin-ink)]">
              {stockAlerts.length}
            </span>
          </div>

          {stockAlerts.length ? (
            <div className="mt-5 space-y-3">
              {stockAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-[1rem]  bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--admin-ink)]">
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
                        {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "recently"}
                      </p>
                      {alert.customer?.city ? <p className="mt-1">{alert.customer.city}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-[var(--admin-muted)]">
              No customers have requested a stock notification for this product yet.
            </p>
          )}
        </AdminPanel>

        <div className="flex flex-wrap justify-center gap-3 border-t border-[var(--admin-line)] pt-6">
          {productId ? (
            <AdminActionButton
              type="button"
              tone="danger"
              onClick={requestProductDelete}
              disabled={deleting || !allowCatalogEdits}
              className="min-w-[180px]"
            >
              {deleting ? "Deleting..." : "Delete Product"}
            </AdminActionButton>
          ) : null}
        </div>
      </form>

      {typeof window !== "undefined" && confirmationModal
        ? createPortal(
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(11,18,10,0.55)] px-4 py-6 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Close confirmation modal"
                onClick={closeConfirmationModal}
              />

              <div className="relative z-[151] w-full max-w-md rounded-[1.35rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_24px_70px_rgba(10,24,11,0.24)]">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                  Confirm action
                </p>
                <h2 className="mt-2 text-lg font-medium text-[var(--admin-ink)]">
                  {confirmationModal.kind === "detail"
                    ? "Remove this detail section?"
                    : "Delete this product?"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
                  {confirmationModal.kind === "detail"
                    ? "This will remove the detail section from the product page."
                    : "This will permanently delete the product from the catalog and cannot be undone."}
                </p>

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeConfirmationModal}
                    className="rounded-full border border-[var(--admin-line-strong)] px-4 py-2 text-sm font-medium text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                  >
                    Cancel
                  </button>
                  <AdminActionButton
                    type="button"
                    tone="danger"
                    onClick={() => void confirmDestructiveAction()}
                    disabled={deleting}
                  >
                    {confirmationModal.kind === "detail" ? "Remove" : deleting ? "Deleting..." : "Delete"}
                  </AdminActionButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof window !== "undefined" && isImageModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(11,18,10,0.55)] px-4 py-6 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Close image modal"
                onClick={closeImageModal}
              />

              <div className="relative z-[141] w-full max-w-6xl rounded-sm bg-white shadow-[0_28px_90px_rgba(10,24,11,0.28)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      {imageModalTitle} Images
                    </p>
                
                    <p className="mt-1 text-sm text-[var(--admin-muted)]">
                      Replace, remove, or upload a new image for the selected slot.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeImageModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--admin-line-strong)] text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
                    aria-label="Close image modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[82vh] overflow-y-auto px-5 py-5">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-[var(--admin-line)] bg-[#fbfcf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--admin-ink)]">Gallery</p>
                   
                        </div>
                        <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-[var(--admin-chip)] px-3 py-1 text-xs font-medium text-[var(--admin-ink)]">
                          {imageModalSlots.length} items
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {imageModalSlots.map((slot) => {
                          const isSelected = slot.index === activeImageSlotIndex;

                          return (
                            <div
                              key={`${imageModalSection}-slot-${slot.index}`}
                              className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-[1rem] border px-3 py-3 transition ${
                                isSelected
                                  ? "border-[var(--admin-accent)] bg-white shadow-[0_10px_24px_rgba(27,79,45,0.08)]"
                                  : "border-[var(--admin-line)] bg-white"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  selectImageModalSlot(imageModalSection || "product", slot.index)
                                }
                                className="shrink-0"
                                aria-label={`Select ${slot.label}`}
                              >
                                <div className="relative h-10 w-10 overflow-hidden rounded-[0.75rem] bg-[var(--admin-chip)]">
                                  {slot.value ? (
                                    <Image
                                      src={slot.value}
                                      alt={`${slot.label} preview`}
                                      fill
                                      className="object-cover"
                                      sizes="40px"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[var(--admin-muted)]">
                                      <ImagePlus size={16} />
                                    </div>
                                  )}
                                </div>
                              </button>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[var(--admin-ink)]">
                                  {slot.label}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] leading-4 text-[var(--admin-muted)]">
                                  {slot.value || "No image added yet"}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectImageModalSlot(imageModalSection || "product", slot.index)
                                  }
                                  className="text-xs font-medium text-[var(--admin-ink)] transition hover:text-[var(--admin-accent)]"
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeImageModalSlot(imageModalSection || "product", slot.index)
                                  }
                                  disabled={!allowCatalogEdits}
                                  className="text-xs font-medium text-[#d13c2f] transition hover:text-[#a72f25] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>

                    <div className="rounded-[1.35rem] border border-dashed border-[var(--admin-line-strong)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--admin-ink)]">
                            Upload Image
                          </p>
                          <p className="mt-1 text-xs text-[var(--admin-muted)]">
                            {activeImageSlot?.label || "Select a slot to replace it."}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-3 py-1 text-xs font-medium text-[var(--admin-ink)]">
                          {activeImageSlotIndex === null ? "0" : activeImageSlotPosition} /{" "}
                          {Math.max(imageModalSlots.length, 1)}
                        </span>
                      </div>

                      <div className="mt-5 grid min-h-[270px] place-items-center rounded-[1.35rem] bg-[var(--admin-chip)] p-5">
                        <div className="w-full max-w-[300px]">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!allowCatalogEdits || isImageUploading}
                            className="mx-auto mb-4 flex h-36 w-full items-center justify-center overflow-hidden rounded-[1.1rem] border border-[var(--admin-line)] bg-white transition hover:border-[var(--admin-accent)] hover:shadow-[0_8px_20px_rgba(27,79,45,0.08)] disabled:cursor-not-allowed disabled:opacity-80"
                            aria-label="Choose image file"
                          >
                            {pendingImagePreviewUrl ? (
                              <Image
                                src={pendingImagePreviewUrl}
                                alt={`${activeImageSlot?.label || "Selected image"} preview`}
                                width={280}
                                height={140}
                                unoptimized
                                className="h-full w-full object-contain p-3"
                              />
                            ) : activeImagePreviewUrl ? (
                              <Image
                                src={activeImagePreviewUrl}
                                alt={`${activeImageSlot?.label || "Selected image"} preview`}
                                width={280}
                                height={140}
                                className="h-full w-full object-contain p-3"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-center text-[var(--admin-muted)]">
                                <ImagePlus size={30} />
                                <span className="text-sm font-medium">Upload image</span>
                              </div>
                            )}
                          </button>

                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] || null;
                                  event.target.value = "";
                                  handleImageFileSelection(file);
                                }}
                              />
                              <AdminActionButton
                                type="button"
                                tone="primary"
                                onClick={() => void uploadPendingImageFile()}
                                disabled={
                                  !allowCatalogEdits ||
                                  isImageUploading ||
                                  !pendingImageFile
                                }
                              >
                                {isImageUploading ? "Uploading..." : "Upload"}
                              </AdminActionButton>
                              {pendingImageFile ? (
                                <span className="truncate text-xs text-[var(--admin-muted)]">
                                  {pendingImageFile.name}
                                </span>
                              ) : null}
                            </div>

                            {!pendingImageFile && !isImageUploading ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={draftImageUrl}
                                    onChange={(event) => {
                                      setDraftImageUrl(event.target.value);
                                      setImageUploadError(null);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        applyImageUrl();
                                      }
                                    }}
                                    className={`${inputClassName()} min-w-0 flex-1`}
                                    placeholder="Enter Url"
                                  />
                                  <AdminActionButton
                                    type="button"
                                    tone="secondary"
                                    onClick={applyImageUrl}
                                    disabled={!allowCatalogEdits || !isDraftUrlValid}
                                    className="shrink-0"
                                  >
                                    Add
                                  </AdminActionButton>
                                </div>
                              </div>
                            ) : null}

                            {imageUploadError ? (
                              <p className="text-xs font-medium text-[#c0392b]">
                                {imageUploadError}
                              </p>
                            ) : null}
                            {activeImageSlotIndex === null ? (
                              <p className="text-xs font-medium text-[var(--admin-muted)]">
                                No slot selected. Upload or add a new image.
                              </p>
                            ) : null}
                            {imageUploadStatus ? (
                              <p className="text-xs font-medium text-[var(--admin-muted)]">
                                {imageUploadStatus}
                              </p>
                            ) : null}

                            {isImageUploading && imageUploadPercent !== null ? (
                              <div className="space-y-1">
                                <div className="h-2 overflow-hidden rounded-full bg-[#e8efe3]">
                                  <div
                                    className="h-full rounded-full bg-[var(--admin-accent)] transition-all duration-200"
                                    style={{ width: `${imageUploadPercent}%` }}
                                  />
                                </div>
                                <p className="text-xs font-semibold text-[#214f14]">
                                  {imageUploadPercent}%
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-[var(--admin-muted)]">
                        Choose a local file to upload it, or paste a valid URL and click Add.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
