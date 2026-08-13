"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Unlink } from "lucide-react";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import {
  AdminErrorCard,
  AdminLoadingCard,
} from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSectionTitle,
  AdminSelect,
  AdminStatusPill,
} from "@/components/admin/AdminUi";
import type {
  AdminLawnGrassPageSettings,
  AdminProduct,
  ApiResponse,
} from "@/lib/admin-api";

function formatProductLabel(product: AdminProduct) {
  return [product.name, product.productId || product.id]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");
}

export default function LawnGrassPageSettingsPage() {
  const { authorizedRequest } = useAdminAuth();
  const [settings, setSettings] = useState<AdminLawnGrassPageSettings | null>(
    null,
  );
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [settingsResponse, productsResponse] = await Promise.all([
        authorizedRequest<
          ApiResponse<{ settings: AdminLawnGrassPageSettings }>
        >("/admin/lawn-grass-page"),
        authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>(
          "/admin/products",
        ),
      ]);

      setSettings(settingsResponse.data.settings);
      setSelectedProductId(settingsResponse.data.settings.product?.id || "");
      setProducts(productsResponse.data.products);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load lawn grass page settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void loadData();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [loadData]);

  async function persistProductLink(productId: string, successMessage: string) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authorizedRequest<
        ApiResponse<{ settings: AdminLawnGrassPageSettings }>
      >("/admin/lawn-grass-page", {
        method: "PATCH",
        body: JSON.stringify({ productId }),
      });

      setSettings(response.data.settings);
      setSelectedProductId(response.data.settings.product?.id || "");
      setMessage(successMessage);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update lawn grass page settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Storefront"
        title="Lawn Grass Page"
        description="Choose the single catalog product used by the public lawn grass calculator page."
      />

      {loading ? (
        <AdminLoadingCard label="Loading lawn grass page settings..." />
      ) : null}
      {!loading && error ? <AdminErrorCard message={error} /> : null}

      {!loading && !error ? (
        <AdminPanel className="space-y-5">
          <AdminSectionTitle
            title="Linked product"
            description="Only one product can power the calculator at a time. Add to cart and buy now use this product directly."
          />

          {message ? (
            <div className="rounded-xl border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-gray-800">
              {message}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">
                  Select product
                </span>
                <AdminSelect
                  className="mt-2"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  <option value="">No product linked</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {formatProductLabel(product)}
                    </option>
                  ))}
                </AdminSelect>
              </label>

              <div className="flex flex-wrap gap-3">
                <AdminActionButton
                  type="button"
                  onClick={() =>
                    void persistProductLink(
                      selectedProductId,
                      selectedProductId
                        ? "Lawn grass calculator product updated."
                        : "Lawn grass calculator product link removed.",
                    )
                  }
                  disabled={
                    saving ||
                    selectedProductId === (settings?.product?.id || "")
                  }
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save product"
                  )}
                </AdminActionButton>
                <AdminActionButton
                  type="button"
                  tone="secondary"
                  onClick={() =>
                    void persistProductLink(
                      "",
                      "Lawn grass calculator product link removed.",
                    )
                  }
                  disabled={saving || !settings?.product}
                >
                  <span className="inline-flex items-center gap-2">
                    <Unlink className="h-4 w-4" />
                    Remove link
                  </span>
                </AdminActionButton>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">Current product</p>
                  <h2 className="mt-2 text-base text-gray-800">
                    {settings?.product?.name || "No product linked"}
                  </h2>
                </div>
                <AdminStatusPill
                  status={settings?.product ? "active" : "inactive"}
                />
              </div>

              {settings?.product ? (
                <div className="mt-4 space-y-3">
                  {settings.product.image ? (
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--admin-chip)]">
                      <Image
                        src={settings.product.image}
                        alt={settings.product.name}
                        fill
                        sizes="22rem"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-2 text-sm text-gray-800">
                    <p>
                      Product ID:{" "}
                      <span className="font-semibold text-gray-800">
                        {settings.product.productId || settings.product.id}
                      </span>
                    </p>
                    <p>
                      Category:{" "}
                      <span className="font-semibold text-gray-800">
                        {settings.product.category || "Uncategorized"}
                      </span>
                    </p>
                    <p>
                      Price:{" "}
                      <span className="font-semibold text-gray-800">
                        Rs. {settings.product.price}
                      </span>
                    </p>
                    <p>
                      Max purchase qty: {" "}
                      <span className="font-semibold text-gray-800">
                        {settings.product.maxPurchaseQuantity ?? "No limit"}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-gray-800">
                  Pick a product and save it to connect the public calculator to
                  a real catalog item.
                </p>
              )}

              {selectedProduct &&
              selectedProduct.id !== settings?.product?.id ? (
                <p className="mt-4 rounded-lg bg-[var(--admin-chip)] px-3 py-2 text-xs text-gray-800">
                  Selected: {selectedProduct.name}
                </p>
              ) : null}
            </div>
          </div>
        </AdminPanel>
      ) : null}
    </div>
  );
}
