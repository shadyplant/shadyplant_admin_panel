"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, FileUp, PencilLine, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import AdminPagination from "@/components/admin/AdminPagination";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminEmptyCard, AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminPill,
  AdminSectionTitle,
  AdminSelect,
  AdminTextInput,
  AdminTextarea,
  AdminToolbar,
} from "@/components/admin/AdminUi";
import type {
  AdminProduct,
  AdminProductStockAdjustment,
  AdminProductStockAdjustmentLog,
  ApiResponse,
} from "@/lib/admin-api";
import { formatAdminCurrency } from "@/lib/admin-utils";
import { canManageCatalog } from "@/lib/admin-permissions";

const STOCK_REASON_OPTIONS = {
  add: [
    { value: "received", label: "Received" },
    { value: "audit_found", label: "Audit found" },
    { value: "return_restock", label: "Return restock" },
    { value: "manual_correction", label: "Manual correction" },
  ],
  adjust: [
    { value: "audit_correction", label: "Audit correction" },
    { value: "damaged", label: "Damaged" },
    { value: "expired", label: "Expired" },
    { value: "shrinkage", label: "Shrinkage" },
    { value: "manual_correction", label: "Manual correction" },
  ],
} as const;

const SPREADSHEET_COLUMNS = [
  "id",
  "productId",
  "sku",
  "skuId",
  "name",
  "category",
  "variety",
  "containerSize",
  "height",
  "growthSpeed",
  "countryOfOrigin",
  "manufacturedBy",
  "marketedBy",
  "potMaterial",
  "hsnCode",
  "price",
  "mrp",
  "weight",
  "offer",
  "minOrderQuantity",
  "maxPurchaseQuantity",
  "stock",
  "isOnTrend",
  "isFeaturedLatest",
  "packLabel",
  "unit",
  "badge",
  "description",
  "image",
  "images",
  "usesImages",
  "tags",
  "leafColor",
  "flowerColor",
  "lightRequirement",
  "waterRequirement",
  "plantPlacement",
  "usageArea",
  "plantAgeMonths",
  "productionCapacity",
  "packagingDetails",
  "optionGroupsJson",
  "detailSectionsJson",
  "quantityPricingSlabsJson",
] as const;

type SpreadsheetRow = Record<string, string>;
type SpreadsheetMatch = {
  product: AdminProduct;
  matchedBy: "id" | "productId" | "sku";
};

type SpreadsheetImportAction = {
  rowNumber: number;
  action: "create" | "update";
  matchedBy: "id" | "productId" | "sku" | "new";
  existingProductId: string;
  existingProductName: string;
  row: SpreadsheetRow;
};

type SpreadsheetImportPreview = {
  fileName: string;
  totalRows: number;
  createCount: number;
  updateCount: number;
  warnings: string[];
  actions: SpreadsheetImportAction[];
  rows: SpreadsheetRow[];
};

const SPREADSHEET_SHEET_NAME = "Products";

const SPREADSHEET_HEADER_MAP: Record<string, string> = {
  id: "id",
  productid: "productId",
  sku: "sku",
  skuid: "skuId",
  name: "name",
  category: "category",
  variety: "variety",
  containersize: "containerSize",
  height: "height",
  growthspeed: "growthSpeed",
  countryoforigin: "countryOfOrigin",
  manufacturedby: "manufacturedBy",
  marketedby: "marketedBy",
  potmaterial: "potMaterial",
  hsncode: "hsnCode",
  price: "price",
  mrp: "mrp",
  weight: "weight",
  offer: "offer",
  minorderquantity: "minOrderQuantity",
  maxpurchasequantity: "maxPurchaseQuantity",
  stock: "stock",
  isontrend: "isOnTrend",
  isfeaturedlatest: "isFeaturedLatest",
  packlabel: "packLabel",
  unit: "unit",
  badge: "badge",
  description: "description",
  image: "image",
  images: "images",
  usesimages: "usesImages",
  tags: "tags",
  leafcolor: "leafColor",
  flowercolor: "flowerColor",
  lightrequirement: "lightRequirement",
  waterrequirement: "waterRequirement",
  plantplacement: "plantPlacement",
  usagearea: "usageArea",
  plantagemonths: "plantAgeMonths",
  productioncapacity: "productionCapacity",
  packagingdetails: "packagingDetails",
  optiongroupsjson: "optionGroupsJson",
  detailsectionsjson: "detailSectionsJson",
  quantitypricingslabsjson: "quantityPricingSlabsJson",
};

function normalizeHeaderKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSpreadsheetCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return String(value).trim();
}

function parseSpreadsheetRows(table: unknown[][]) {
  const [headerRow, ...dataRows] = table.filter((row) =>
    row.some((cell) => normalizeSpreadsheetCell(cell).length),
  );

  if (!headerRow) {
    return [];
  }

  const headerLookup = headerRow.map((headerCell) => {
    const canonicalKey = SPREADSHEET_HEADER_MAP[normalizeHeaderKey(headerCell)];
    return canonicalKey || String(headerCell ?? "").trim();
  });

  return dataRows.map((row) => {
    const record: SpreadsheetRow = {};
    headerLookup.forEach((columnName, index) => {
      if (columnName) {
        record[columnName] = normalizeSpreadsheetCell(row[index]);
      }
    });
    SPREADSHEET_COLUMNS.forEach((column) => {
      if (!(column in record)) {
        record[column] = "";
      }
    });
    return record;
  });
}

function toPipeSeparated(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(" | ");
}

function parseOptionalJsonArray(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return trimmed
      .split(/[|,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

function parseOptionalJson(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseBooleanCell(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
}

function parseNumberCell(value: string) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumberCell(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildSpreadsheetRow(product: AdminProduct): SpreadsheetRow {
  return {
    id: product.id || "",
    productId: product.productId || "",
    sku: product.sku || "",
    skuId: product.skuId || "",
    name: product.name || "",
    category: product.category || "",
    variety: product.variety || "",
    containerSize: product.containerSize || "",
    height: product.height || "",
    growthSpeed: product.growthSpeed || "",
    countryOfOrigin: product.countryOfOrigin || "",
    manufacturedBy: product.manufacturedBy || "",
    marketedBy: product.marketedBy || "",
    potMaterial: product.potMaterial || "",
    hsnCode: product.hsnCode || "",
    price: String(product.price ?? ""),
    mrp: String(product.mrp ?? product.price ?? ""),
    weight: String(product.weight ?? ""),
    offer: product.offer || "",
    minOrderQuantity: String(product.minOrderQuantity ?? 1),
    maxPurchaseQuantity: String(product.maxPurchaseQuantity ?? ""),
    stock: String(product.stock ?? 0),
    isOnTrend: String(Boolean(product.isOnTrend)),
    isFeaturedLatest: String(Boolean(product.isFeaturedLatest)),
    packLabel: product.packLabel || "",
    unit: product.unit || "",
    badge: product.badge || "",
    description: product.description || "",
    image: product.image || "",
    images: toPipeSeparated(product.images || []),
    usesImages: toPipeSeparated(product.usesImages || []),
    tags: toPipeSeparated(product.tags || []),
    leafColor: product.leafColor || "",
    flowerColor: product.flowerColor || "",
    lightRequirement: product.lightRequirement || "",
    waterRequirement: product.waterRequirement || "",
    plantPlacement: product.plantPlacement || "",
    usageArea: product.usageArea || "",
    plantAgeMonths:
      product.plantAgeMonths === null || product.plantAgeMonths === undefined
        ? ""
        : String(product.plantAgeMonths),
    productionCapacity:
      product.productionCapacity === null || product.productionCapacity === undefined
        ? ""
        : String(product.productionCapacity),
    packagingDetails: product.packagingDetails || "",
    optionGroupsJson: JSON.stringify(product.optionGroups || []),
    detailSectionsJson: JSON.stringify(product.detailSections || []),
    quantityPricingSlabsJson: JSON.stringify(product.quantityPricingSlabs || []),
  };
}

function buildSpreadsheetWorkbook(products: AdminProduct[]) {
  const rows = products.map(buildSpreadsheetRow);
  const worksheetData = [
    [...SPREADSHEET_COLUMNS],
    ...rows.map((row) => SPREADSHEET_COLUMNS.map((column) => row[column] ?? "")),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SPREADSHEET_SHEET_NAME);
  return workbook;
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function findProductMatchForSpreadsheetRow(
  products: AdminProduct[],
  row: SpreadsheetRow,
) : SpreadsheetMatch | null {
  const rowId = String(row.id || "").trim();
  const rowProductId = String(row.productId || "").trim();
  const rowSku = String(row.sku || "").trim();

  if (rowId) {
    const byId = products.find((product) => product.id === rowId);
    if (byId) {
      return { product: byId, matchedBy: "id" };
    }
  }

  if (rowProductId) {
    const byProductId = products.find(
      (product) => product.productId === rowProductId,
    );
    if (byProductId) {
      return { product: byProductId, matchedBy: "productId" };
    }
  }

  if (rowSku) {
    const bySku = products.find((product) => product.sku === rowSku);
    if (bySku) {
      return { product: bySku, matchedBy: "sku" };
    }
  }

  return null;
}

function findProductForSpreadsheetRow(
  products: AdminProduct[],
  row: SpreadsheetRow,
) {
  return findProductMatchForSpreadsheetRow(products, row)?.product || null;
}

function buildProductPayloadFromSpreadsheetRow(
  row: SpreadsheetRow,
  existingProduct?: AdminProduct | null,
) {
  const safeText = (key: string, fallback?: string) => {
    const value = String(row[key] || "").trim();
    if (value) {
      return value;
    }
    return fallback;
  };

  const resolveNumber = (key: string, fallback = 0) => {
    const value = String(row[key] || "").trim();
    if (!value) {
      return fallback;
    }
    const parsed = parseNumberCell(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const resolveOptionalNumber = (
    key: string,
    fallback: number | null = null,
  ) => {
    const value = String(row[key] || "").trim();
    if (!value) {
      return fallback;
    }
    return parseOptionalNumberCell(value) ?? fallback;
  };

  const existingImages = existingProduct?.images || [];
  const existingUsesImages = existingProduct?.usesImages || [];
  const existingTags = existingProduct?.tags || [];
  const parsedImages = parseOptionalJsonArray(row.images);
  const parsedUsesImages = parseOptionalJsonArray(row.usesImages);
  const parsedTags = parseOptionalJsonArray(row.tags);

  const optionGroups = parseOptionalJson(row.optionGroupsJson);
  const detailSections = parseOptionalJson(row.detailSectionsJson);
  const quantityPricingSlabs = parseOptionalJson(row.quantityPricingSlabsJson);

  const payload = {
    id: safeText("id", existingProduct?.id),
    sku: safeText("sku", existingProduct?.sku),
    hsnCode: safeText("hsnCode", existingProduct?.hsnCode),
    name: safeText("name", existingProduct?.name || ""),
    category: safeText("category", existingProduct?.category || ""),
    variety: safeText("variety", existingProduct?.variety || ""),
    containerSize: safeText("containerSize", existingProduct?.containerSize || ""),
    height: safeText("height", existingProduct?.height || ""),
    growthSpeed: safeText("growthSpeed", existingProduct?.growthSpeed || ""),
    countryOfOrigin: safeText(
      "countryOfOrigin",
      existingProduct?.countryOfOrigin || "",
    ),
    manufacturedBy: safeText(
      "manufacturedBy",
      existingProduct?.manufacturedBy || "",
    ),
    marketedBy: safeText("marketedBy", existingProduct?.marketedBy || ""),
    potMaterial: safeText("potMaterial", existingProduct?.potMaterial || ""),
    leafColor: safeText("leafColor", existingProduct?.leafColor || ""),
    flowerColor: safeText("flowerColor", existingProduct?.flowerColor || ""),
    lightRequirement: safeText(
      "lightRequirement",
      existingProduct?.lightRequirement || "",
    ),
    waterRequirement: safeText(
      "waterRequirement",
      existingProduct?.waterRequirement || "",
    ),
    plantPlacement: safeText(
      "plantPlacement",
      existingProduct?.plantPlacement || "",
    ),
    usageArea: safeText("usageArea", existingProduct?.usageArea || ""),
    plantAgeMonths: resolveOptionalNumber(
      "plantAgeMonths",
      existingProduct?.plantAgeMonths ?? null,
    ),
    productionCapacity: resolveOptionalNumber(
      "productionCapacity",
      existingProduct?.productionCapacity ?? null,
    ),
    packagingDetails: safeText(
      "packagingDetails",
      existingProduct?.packagingDetails || "",
    ),
    price: resolveNumber("price", existingProduct?.price ?? 0),
    mrp: Math.max(
      resolveNumber("mrp", existingProduct?.mrp ?? existingProduct?.price ?? 0),
      resolveNumber("price", existingProduct?.price ?? 0),
    ),
    weight: resolveNumber("weight", existingProduct?.weight ?? 0),
    offer: safeText("offer", existingProduct?.offer || ""),
    minOrderQuantity: resolveNumber(
      "minOrderQuantity",
      existingProduct?.minOrderQuantity ?? 1,
    ),
    maxPurchaseQuantity: resolveNumber(
      "maxPurchaseQuantity",
      existingProduct?.maxPurchaseQuantity ?? undefined,
    ),
    stock: Math.max(0, resolveNumber("stock", existingProduct?.stock ?? 0)),
    isOnTrend:
      String(row.isOnTrend || "").trim() === ""
        ? Boolean(existingProduct?.isOnTrend)
        : parseBooleanCell(row.isOnTrend),
    isFeaturedLatest:
      String(row.isFeaturedLatest || "").trim() === ""
        ? Boolean(existingProduct?.isFeaturedLatest)
        : parseBooleanCell(row.isFeaturedLatest),
    packLabel: safeText("packLabel", existingProduct?.packLabel || ""),
    unit: safeText("unit", existingProduct?.unit || ""),
    badge: safeText("badge", existingProduct?.badge || ""),
    description: safeText("description", existingProduct?.description || ""),
    image: safeText("image", existingProduct?.image || ""),
    images: parsedImages.length ? parsedImages : existingImages,
    usesImages: parsedUsesImages.length ? parsedUsesImages : existingUsesImages,
    tags: parsedTags.length ? parsedTags : existingTags,
    optionGroups:
      Array.isArray(optionGroups) && optionGroups.length
        ? optionGroups
        : existingProduct?.optionGroups || [],
    detailSections:
      Array.isArray(detailSections) && detailSections.length
        ? detailSections
        : existingProduct?.detailSections || [],
    quantityPricingSlabs:
      Array.isArray(quantityPricingSlabs) && quantityPricingSlabs.length
        ? quantityPricingSlabs
        : existingProduct?.quantityPricingSlabs || [],
  };

  return payload;
}

export default function ProductsPage() {
  const { authorizedRequest, staff } = useAdminAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<AdminProduct | null>(null);
  const [confirmOperation, setConfirmOperation] = useState<"add" | "adjust">("add");
  const [modalQuantity, setModalQuantity] = useState("1");
  const [modalReason, setModalReason] = useState("received");
  const [stockNote, setStockNote] = useState("");
  const [stockLogs, setStockLogs] = useState<AdminProductStockAdjustmentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [spreadsheetBusy, setSpreadsheetBusy] = useState(false);
  const [spreadsheetMessage, setSpreadsheetMessage] = useState<string | null>(
    null,
  );
  const [importPreview, setImportPreview] =
    useState<SpreadsheetImportPreview | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

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

  async function openAdjustModal(
    product: AdminProduct,
    operation: "add" | "adjust",
  ) {
    setConfirmProduct(product);
    setConfirmOperation(operation);
    setModalQuantity(operation === "add" ? "1" : String(product.stock ?? 0));
    setModalReason(operation === "add" ? "received" : "audit_correction");
    setStockNote("");
    setLogsLoading(true);

    try {
      const response = await authorizedRequest<
        ApiResponse<{
          product: Pick<AdminProduct, "id" | "productId" | "name" | "stock">;
          logs: AdminProductStockAdjustmentLog[];
        }>
      >(`/admin/products/${product.id}/stock-logs?limit=8`);
      setStockLogs(response.data.logs);
    } catch {
      setStockLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAdjustStock() {
    if (!confirmProduct) {
      return;
    }

    const product = confirmProduct;
    const rawQuantity = modalQuantity;
    const quantity = Math.floor(Number(rawQuantity || 0));
    const reason = modalReason || "manual_correction";

    if (confirmOperation === "add") {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        window.alert("Enter a stock quantity greater than zero.");
        return;
      }
    } else if (!Number.isFinite(quantity) || quantity < 0) {
      window.alert("Enter the final available stock as zero or greater.");
      return;
    }

    setAdjustingId(product.id);

    try {
      const response = await authorizedRequest<
        ApiResponse<{
          product: AdminProduct;
          adjustment: AdminProductStockAdjustment;
        }>
      >(`/admin/products/${product.id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({
          operation: confirmOperation,
          ...(confirmOperation === "add"
            ? { quantity }
            : { nextStock: quantity }),
          reason,
          note: stockNote,
        }),
      });

      setProducts((currentProducts) =>
        currentProducts.map((entry) =>
          entry.id === product.id ? response.data.product : entry,
        ),
      );
      setConfirmProduct(null);
      setStockLogs((currentLogs) => [
        {
          id: `temp-${Date.now()}`,
          productId: response.data.product.id,
          productReference: response.data.product.productId,
          productName: response.data.product.name,
          operation: response.data.adjustment.operation,
          quantity: response.data.adjustment.quantity,
          delta: response.data.adjustment.delta,
          reason: response.data.adjustment.reason || "",
          note: response.data.adjustment.note || "",
          previousStock: response.data.adjustment.previousStock,
          currentStock: response.data.adjustment.currentStock,
          actor: {
            staffAccountId: "",
            email: staff?.email || "",
            role: staff?.role || "",
          },
          createdAt: response.data.adjustment.adjustedAt,
          updatedAt: response.data.adjustment.adjustedAt,
        },
        ...currentLogs,
      ]);
    } catch (nextError) {
      window.alert(
        nextError instanceof Error
          ? nextError.message
          : "Unable to adjust stock right now.",
      );
    } finally {
      setAdjustingId(null);
    }
  }

  function buildSpreadsheetImportPreview(
    rows: SpreadsheetRow[],
    fileName: string,
  ): SpreadsheetImportPreview {
    const actions: SpreadsheetImportAction[] = rows.map((row, index) => {
      const match = findProductMatchForSpreadsheetRow(products, row);
      return {
        rowNumber: index + 2,
        action: (match ? "update" : "create") as "update" | "create",
        matchedBy: (match?.matchedBy || "new") as
          | "id"
          | "productId"
          | "sku"
          | "new",
        existingProductId: match?.product.id || "",
        existingProductName: match?.product.name || "",
        row,
      };
    });

    const createCount = actions.filter((entry) => entry.action === "create").length;
    const updateCount = actions.filter((entry) => entry.action === "update").length;
    const warnings: string[] = [];

    const duplicateKeys = new Map<string, number[]>();
    actions.forEach((entry) => {
      const key = [
        entry.row.id.trim(),
        entry.row.productId.trim(),
        entry.row.sku.trim(),
      ]
        .filter(Boolean)
        .join("|");

      if (!key) {
        return;
      }

      const existing = duplicateKeys.get(key) || [];
      existing.push(entry.rowNumber);
      duplicateKeys.set(key, existing);
    });

    const duplicateWarnings = Array.from(duplicateKeys.entries())
      .filter(([, rowNumbers]) => rowNumbers.length > 1)
      .map(([, rowNumbers]) => `Duplicate identifier rows: ${rowNumbers.join(", ")}`);

    warnings.push(...duplicateWarnings);

    return {
      fileName,
      totalRows: rows.length,
      createCount,
      updateCount,
      warnings,
      actions,
      rows,
    };
  }

  async function exportProducts(scope: "all" | "filtered") {
    const exportRows = scope === "all" ? products : filteredProducts;
    const label = scope === "all" ? "all" : "filtered";
    downloadWorkbook(
      buildSpreadsheetWorkbook(exportRows),
      `products-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  async function upsertSpreadsheetProducts(rows: SpreadsheetRow[]) {
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      const existingProduct = findProductForSpreadsheetRow(products, row);
      const payload = buildProductPayloadFromSpreadsheetRow(
        row,
        existingProduct,
      );

      if (existingProduct) {
        await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
          `/admin/products/${existingProduct.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        updatedCount += 1;
      } else {
        await authorizedRequest<ApiResponse<{ product: AdminProduct }>>(
          "/admin/products",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        createdCount += 1;
      }
    }
    return { createdCount, updatedCount };
  }

  async function handleImportSpreadsheetFile(file: File | null) {
    if (!file) {
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setSpreadsheetMessage("Please upload a .xlsx workbook exported from Excel.");
      return;
    }

    setSpreadsheetBusy(true);
    setSpreadsheetMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("Workbook does not contain any sheets.");
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error("Unable to read the first worksheet.");
      }

      const table = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      const rows = parseSpreadsheetRows(table);

      if (!rows.length) {
        setSpreadsheetMessage("No data rows were found in the workbook.");
        setImportPreview(null);
        return;
      }

      setImportPreview(buildSpreadsheetImportPreview(rows, file.name));
    } catch (nextError) {
      setSpreadsheetMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to read the workbook right now.",
      );
      setImportPreview(null);
    } finally {
      setSpreadsheetBusy(false);
    }
  }

  async function applySpreadsheetImport() {
    if (!importPreview) {
      return;
    }

    setSpreadsheetBusy(true);
    setSpreadsheetMessage(null);

    try {
      const result = await upsertSpreadsheetProducts(importPreview.rows);
      await loadProducts();
      setSpreadsheetMessage(
        `Import complete: ${result.createdCount} created, ${result.updatedCount} updated.`,
      );
      setImportPreview(null);
    } catch (nextError) {
      setSpreadsheetMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to import products right now.",
      );
    } finally {
      setSpreadsheetBusy(false);
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
      product.sku,
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
  const availableReasonOptions = STOCK_REASON_OPTIONS[confirmOperation];

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
        <AdminToolbar className="flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdminTextInput
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, product id, sku, category, or tag"
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
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <AdminActionButton
                tone="secondary"
                onClick={() => exportProducts("all")}
                disabled={spreadsheetBusy}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export XLSX
              </AdminActionButton>
              <AdminActionButton
                tone="secondary"
                onClick={() => exportProducts("filtered")}
                disabled={spreadsheetBusy || !filteredProducts.length}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Filtered XLSX
              </AdminActionButton>
              <AdminActionButton
                tone="secondary"
                onClick={() => importFileRef.current?.click()}
                disabled={spreadsheetBusy}
                className="gap-2"
              >
                <FileUp className="h-4 w-4" />
                Import XLSX
              </AdminActionButton>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = "";
                  await handleImportSpreadsheetFile(file);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminPill>{products.length} total</AdminPill>
              <AdminPill>
                {products.filter((product) => product.isFeaturedLatest).length} featured
              </AdminPill>
              {spreadsheetMessage ? <AdminPill>{spreadsheetMessage}</AdminPill> : null}
            </div>
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
          <AdminPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-left">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Product
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Category
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Price
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Stock
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Stock Adjust
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Flags
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-300 align-top transition hover:bg-[#fbfdf8]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex min-w-[280px] items-start gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[0.9rem] bg-[var(--admin-chip)]">
                            {product.image ? (
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[11px] font-medium text-gray-800">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-800">
                              {product.productId}
                            </p>
                            <h2 className="mt-0.5 text-sm font-medium text-gray-800 line-clamp-1 max-w-xl">
                              {product.name}
                            </h2>
                            <p className="mt-0.5 line-clamp-1 max-w-xl text-sm leading-5 text-gray-800">
                              {product.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[150px]">
                          <p className="text-sm font-medium text-gray-800">
                            {product.category || "Uncategorized"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[120px]">
                          <p className="text-sm font-medium text-gray-800">
                            {formatAdminCurrency(product.price)}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-[120px]">
                          <p className="text-sm font-medium text-gray-800">
                            {product.stock > 0 ? product.stock : 0}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[220px] items-center gap-2">
                            <AdminActionButton
                              tone="secondary"
                              onClick={() => void openAdjustModal(product, "add")}
                              disabled={adjustingId === product.id || !allowCatalogEdits}
                              className="min-w-[104px] whitespace-nowrap border-[var(--admin-accent)] bg-transparent px-3 py-2 text-[var(--admin-accent)] hover:bg-transparent hover:border-[#3f744d] hover:text-[#3f744d]"
                            >
                              Stock Add
                            </AdminActionButton>
                            <AdminActionButton
                              tone="secondary"
                              onClick={() => void openAdjustModal(product, "adjust")}
                              disabled={adjustingId === product.id || !allowCatalogEdits}
                              className="min-w-[128px] whitespace-nowrap border-[#b24336] bg-transparent px-3 py-2 text-[#b24336] hover:bg-transparent hover:border-[#9b362b] hover:text-[#9b362b]"
                            >
                              Adjust Stock
                            </AdminActionButton>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[220px] flex-wrap gap-2">
                          {product.isFeaturedLatest ? (
                            <AdminPill>Featured</AdminPill>
                          ) : null}
                          {product.isOnTrend ? <AdminPill>Trending</AdminPill> : null}
                          {product.optionGroups?.length ? (
                            <AdminPill>{product.optionGroups.length} options</AdminPill>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex min-w-[180px] flex-row items-center gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="inline-flex min-w-[112px] items-center justify-center gap-2 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-semibold text-gray-800 transition hover:text-[var(--admin-ink)]"
                          >
                            <PencilLine className="h-4 w-4 shrink-0" />
                            Edit
                          </Link>
                          {allowCatalogEdits ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(product)}
                              disabled={deletingId === product.id}
                              className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-none border-0 bg-transparent px-0 py-0 text-sm font-semibold text-[#b24336] transition hover:text-[#9b362b] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                              {deletingId === product.id ? "Deleting..." : "Delete"}
                            </button>
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

      {confirmProduct ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,12,0.42)] p-4">
          <div className="w-full max-w-2xl rounded-[1.25rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_24px_80px_rgba(18,43,16,0.2)]">
            <AdminSectionTitle
              title={`${confirmOperation === "add" ? "Add" : "Adjust"} stock`}
              description={`Confirm stock adjustment for ${confirmProduct.name}.`}
            />

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-[1rem] bg-[var(--admin-chip)] p-4">
                <div className="text-sm text-gray-800">
                  Product
                </div>
                <div className="text-base font-black text-[var(--admin-ink)]">
                  {confirmProduct.name}
                </div>
                <div className="text-sm text-gray-800">
                  Current stock: <span className="font-semibold text-[var(--admin-ink)]">{confirmProduct.stock}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <AdminTextInput
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={modalQuantity}
                    onChange={(event) => setModalQuantity(event.target.value)}
                    placeholder={confirmOperation === "add" ? "Quantity" : "New available stock"}
                  />
                  <AdminSelect
                    value={modalReason}
                    onChange={(event) => setModalReason(event.target.value)}
                  >
                    {availableReasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <AdminTextarea
                  value={stockNote}
                  onChange={(event) => setStockNote(event.target.value)}
                  placeholder="Optional note for audit log"
                  className="min-h-[96px]"
                />
              </div>

              <div className="space-y-3">
                <div className="rounded-[1rem] border border-[var(--admin-line)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-800">
                    Recent audit logs
                  </p>
                  <div className="mt-3 space-y-3">
                    {logsLoading ? (
                      <p className="text-sm text-gray-800">Loading logs...</p>
                    ) : stockLogs.length ? (
                      stockLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-[0.9rem] bg-[var(--admin-chip)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--admin-ink)]">
                              {log.operation === "add"
                                ? `+${log.quantity}`
                                : `Set to ${log.currentStock}`}
                            </span>
                            <span className="text-xs uppercase tracking-[0.14em] text-gray-800">
                              {log.reason.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-800">
                            {log.previousStock} to {log.currentStock}
                            {log.actor.email ? ` by ${log.actor.email}` : ""}
                          </p>
                          {log.note ? (
                            <p className="mt-1 text-xs text-gray-800">{log.note}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-800">No stock audit logs yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <AdminActionButton
                tone="secondary"
                onClick={() => setConfirmProduct(null)}
                disabled={adjustingId === confirmProduct.id}
              >
                Cancel
              </AdminActionButton>
              <AdminActionButton
                tone={confirmOperation === "adjust" ? "secondary" : "primary"}
                onClick={() => void handleAdjustStock()}
                disabled={adjustingId === confirmProduct.id}
              >
                {adjustingId === confirmProduct.id
                  ? "Saving..."
                  : confirmOperation === "add"
                    ? "Confirm Add"
                    : "Confirm Adjust"}
              </AdminActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {importPreview ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,12,0.52)] p-4">
          <div className="w-full max-w-5xl rounded-[1.25rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_24px_80px_rgba(18,43,16,0.24)]">
            <AdminSectionTitle
              title="Review spreadsheet import"
              description={`${importPreview.fileName} is ready. Review the create and update counts before applying it to the catalog.`}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AdminPill>{importPreview.totalRows} rows</AdminPill>
              <AdminPill>{importPreview.createCount} create</AdminPill>
              <AdminPill>{importPreview.updateCount} update</AdminPill>
              {importPreview.warnings.length ? (
                <AdminPill>{importPreview.warnings.length} warnings</AdminPill>
              ) : null}
            </div>

            {importPreview.warnings.length ? (
              <div className="mt-4 rounded-[1rem] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {importPreview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-[1rem] border border-[var(--admin-line)]">
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr className="border-b border-gray-300">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Row
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Action
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Match
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Product
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Category
                      </th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-800">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.actions.slice(0, 50).map((entry) => (
                      <tr
                        key={`${entry.rowNumber}-${entry.row.productId}-${entry.row.sku}`}
                        className="border-b border-gray-200 align-top"
                      >
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {entry.rowNumber}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[var(--admin-ink)]">
                          {entry.action === "update" ? "Update" : "Create"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {entry.action === "update"
                            ? `${entry.matchedBy}${entry.existingProductId ? ` • ${entry.existingProductId}` : ""}`
                            : "New product"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="min-w-[220px]">
                            <p className="font-medium text-[var(--admin-ink)]">
                              {entry.row.name || "Unnamed product"}
                            </p>
                            {entry.action === "update" && entry.existingProductName ? (
                              <p className="text-xs text-gray-800">
                                Existing: {entry.existingProductName}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {entry.row.sku || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {entry.row.category || "Uncategorized"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {entry.row.price || "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {importPreview.actions.length > 50 ? (
              <p className="mt-3 text-xs text-gray-800">
                Showing the first 50 staged rows for review.
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-800">
                Showing all staged rows. The import will compare against the latest
                catalog when you click Apply.
              </p>
              <div className="flex items-center gap-3">
                <AdminActionButton
                  tone="secondary"
                  onClick={() => setImportPreview(null)}
                  disabled={spreadsheetBusy}
                >
                  Cancel
                </AdminActionButton>
                <AdminActionButton
                  tone="primary"
                  onClick={() => void applySpreadsheetImport()}
                  disabled={spreadsheetBusy}
                >
                  {spreadsheetBusy ? "Applying..." : "Apply Import"}
                </AdminActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
