"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Autocomplete,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useAdminAuth } from "@/components/admin/AdminAuthProvider";
import { AdminErrorCard, AdminLoadingCard } from "@/components/admin/AdminDataState";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AdminActionButton,
  AdminPanel,
  AdminSelect,
  AdminStatusPill,
} from "@/components/admin/AdminUi";
import { FormField, FormGrid, inputClassName, textareaClassName } from "@/components/admin/Forms";
import type {
  AdminCheckoutPreview,
  AdminCustomer,
  AdminCustomerCart,
  AdminPaymentAttempt,
  AdminPaymentCheckout,
  AdminProduct,
  ApiResponse,
} from "@/lib/admin-api";
import {
  formatAdminCurrency,
  formatAdminDate,
} from "@/lib/admin-utils";

type CustomerEditorPageProps = {
  customerId: string;
};

type CartAddFormState = {
  productQuery: string;
};

type CustomerSettingsFormState = {
  isVip: boolean;
  customerCategory: AdminCustomer["customerCategory"];
};

type CheckoutFormState = {
  formattedAddress: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  landmark: string;
  notes: string;
  lat: string;
  lng: string;
  billingName: string;
  billingContact: string;
  billingEmail: string;
  couponCode: string;
  paymentMethod: "online_payment" | "emi";
};

const MAP_LIBRARIES: "places"[] = ["places"];
const DEFAULT_MAP_CENTER = {
  lat: 26.2457163,
  lng: 90.9172911,
};

const buildCartItemQuantityDrafts = (cart: AdminCustomerCart | null) =>
  Object.fromEntries(
    (cart?.items || []).map((item) => [item.id, String(item.quantity || 1)]),
  );

const buildCheckoutFormFromCustomer = (customer: AdminCustomer): CheckoutFormState => ({
  formattedAddress: String(customer.deliveryAddress?.formattedAddress || ""),
  line1: String(customer.deliveryAddress?.line1 || ""),
  line2: String(customer.deliveryAddress?.line2 || ""),
  city: String(customer.deliveryAddress?.city || ""),
  state: String(customer.deliveryAddress?.state || ""),
  postalCode: String(customer.deliveryAddress?.postalCode || ""),
  landmark: String(customer.deliveryAddress?.landmark || ""),
  notes: String(customer.deliveryAddress?.notes || ""),
  lat: "",
  lng: "",
  billingName: String(customer.billingDetails?.name || customer.fullName || ""),
  billingContact: String(customer.billingDetails?.contact || customer.phoneNumber || ""),
  billingEmail: String(customer.email || ""),
  couponCode: "",
  paymentMethod: customer.paymentAccess.emi ? "emi" : "online_payment",
});

const buildCheckoutPayload = (checkoutForm: CheckoutFormState) => ({
  deliveryAddress: {
    formattedAddress: checkoutForm.formattedAddress.trim(),
    line1: checkoutForm.line1.trim(),
    line2: checkoutForm.line2.trim(),
    city: checkoutForm.city.trim(),
    state: checkoutForm.state.trim(),
    postalCode: checkoutForm.postalCode.trim(),
    landmark: checkoutForm.landmark.trim(),
    notes: checkoutForm.notes.trim(),
  },
  deliveryLocation: {
    lat: Number(checkoutForm.lat),
    lng: Number(checkoutForm.lng),
  },
  billingDetails: {
    name: checkoutForm.billingName.trim(),
    contact: checkoutForm.billingContact.trim(),
    email: checkoutForm.billingEmail.trim(),
    address: checkoutForm.line1.trim() || checkoutForm.formattedAddress.trim(),
    city: checkoutForm.city.trim(),
    state: checkoutForm.state.trim(),
  },
  couponCode: checkoutForm.couponCode.trim().toUpperCase(),
  paymentMethod: checkoutForm.paymentMethod,
});

const buildQrImageUrl = (paymentUrl: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(paymentUrl)}`;

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_self" | "_blank";
        returnUrl?: string;
      }) => Promise<unknown>;
    };
  }
}

let cashfreeScriptPromise: Promise<void> | null = null;

function loadCashfreeScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree checkout is unavailable right now."));
  }

  if (window.Cashfree) {
    return Promise.resolve();
  }

  if (cashfreeScriptPromise) {
    return cashfreeScriptPromise;
  }

  cashfreeScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load the Cashfree checkout SDK."));
    document.head.appendChild(script);
  });

  return cashfreeScriptPromise;
}

export default function CustomerEditorPage({ customerId }: CustomerEditorPageProps) {
  const { authorizedRequest } = useAdminAuth();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries: MAP_LIBRARIES,
  });
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [cart, setCart] = useState<AdminCustomerCart | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [customerSettingsForm, setCustomerSettingsForm] =
    useState<CustomerSettingsFormState | null>(null);
  const [cartAddForm, setCartAddForm] = useState<CartAddFormState>({
    productQuery: "",
  });
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState | null>(null);
  const [checkoutPreview, setCheckoutPreview] = useState<AdminCheckoutPreview | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<AdminPaymentCheckout | null>(null);
  const [activePaymentAttempt, setActivePaymentAttempt] = useState<AdminPaymentAttempt | null>(
    null,
  );
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [cartItemQuantityDrafts, setCartItemQuantityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [updatingCartItemId, setUpdatingCartItemId] = useState<string | null>(null);
  const [removingCartItemId, setRemovingCartItemId] = useState<string | null>(null);
  const [previewingCheckout, setPreviewingCheckout] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [pollingPaymentAttempt, setPollingPaymentAttempt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [customerMessage, setCustomerMessage] = useState<string | null>(null);
  const [savingCustomerSettings, setSavingCustomerSettings] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState(DEFAULT_MAP_CENTER);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await Promise.all([
        authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          `/admin/customers/${customerId}`,
        ),
        authorizedRequest<ApiResponse<{ cart: AdminCustomerCart }>>(
          `/admin/customers/${customerId}/cart`,
        ),
        authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>("/admin/products"),
      ]);

      const nextCustomer = response[0].data.customer;
      const nextCart = response[1].data.cart;
      const nextCheckoutForm = buildCheckoutFormFromCustomer(nextCustomer);
      setCustomer(nextCustomer);
      setCustomerSettingsForm({
        isVip: Boolean(nextCustomer.isVip),
        customerCategory: nextCustomer.customerCategory,
      });
      setCart(nextCart);
      setProducts(response[2].data.products);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(nextCart));
      setCheckoutForm(nextCheckoutForm);
      const nextLat = Number(nextCheckoutForm.lat);
      const nextLng = Number(nextCheckoutForm.lng);
      if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
        setMarkerPosition({ lat: nextLat, lng: nextLng });
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load customer details.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, customerId]);

  useEffect(() => {
    let cancelled = false;

    async function syncCustomer() {
      setLoading(true);
      setError(null);

      try {
        const response = await Promise.all([
          authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
            `/admin/customers/${customerId}`,
          ),
          authorizedRequest<ApiResponse<{ cart: AdminCustomerCart }>>(
            `/admin/customers/${customerId}/cart`,
          ),
          authorizedRequest<ApiResponse<{ products: AdminProduct[] }>>("/admin/products"),
        ]);

        if (cancelled) {
          return;
        }

        const nextCustomer = response[0].data.customer;
        const nextCart = response[1].data.cart;
        const nextCheckoutForm = buildCheckoutFormFromCustomer(nextCustomer);
        setCustomer(nextCustomer);
        setCustomerSettingsForm({
          isVip: Boolean(nextCustomer.isVip),
          customerCategory: nextCustomer.customerCategory,
        });
        setCart(nextCart);
        setProducts(response[2].data.products);
        setCartItemQuantityDrafts(buildCartItemQuantityDrafts(nextCart));
        setCheckoutForm(nextCheckoutForm);
        const nextLat = Number(nextCheckoutForm.lat);
        const nextLng = Number(nextCheckoutForm.lng);
        if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
          setMarkerPosition({ lat: nextLat, lng: nextLng });
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load customer details.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncCustomer();

    return () => {
      cancelled = true;
    };
  }, [authorizedRequest, customerId]);

  useEffect(() => {
    const paymentAttemptId = activeCheckout?.paymentAttemptId;

    if (!paymentAttemptId) {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(() => {
      void syncPaymentAttempt();
    }, 4000);

    async function syncPaymentAttempt() {
      setPollingPaymentAttempt(true);

      try {
        const response =
          await authorizedRequest<
            ApiResponse<{
              customer: AdminCustomer;
              cart: AdminCustomerCart;
              paymentAttempt: AdminPaymentAttempt;
            }>
          >(
            `/admin/customers/${customerId}/cart/checkout/payment-attempts/${paymentAttemptId}`,
          );

        if (!isActive) {
          return;
        }

        setCustomer(response.data.customer);
        setCart(response.data.cart);
        setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
        setActivePaymentAttempt(response.data.paymentAttempt);

        if (
          response.data.paymentAttempt.status === "completed" ||
          response.data.paymentAttempt.status === "failed"
        ) {
          window.clearInterval(intervalId);
          setPollingPaymentAttempt(false);
          if (response.data.paymentAttempt.status === "completed") {
            setCheckoutMessage("Payment verified and order finalized successfully.");
            void loadCustomer();
          }
        }
      } catch (nextError) {
        if (isActive) {
          setCheckoutMessage(
            nextError instanceof Error
              ? nextError.message
              : "Unable to refresh payment transaction status.",
          );
        }
      } finally {
        if (isActive) {
          setPollingPaymentAttempt(false);
        }
      }
    }

    void syncPaymentAttempt();

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [activeCheckout?.paymentAttemptId, authorizedRequest, customerId, loadCustomer]);

  async function handleSaveCustomerSettings() {
    if (!customerSettingsForm) {
      return;
    }

    setSavingCustomerSettings(true);
    setCustomerMessage(null);

    try {
      const response =
        await authorizedRequest<ApiResponse<{ customer: AdminCustomer }>>(
          `/admin/customers/${customerId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              isVip: customerSettingsForm.isVip,
              customerCategory: customerSettingsForm.customerCategory,
            }),
          },
        );

      setCustomer(response.data.customer);
      setCustomerSettingsForm({
        isVip: Boolean(response.data.customer.isVip),
        customerCategory: response.data.customer.customerCategory,
      });
      setCustomerMessage("Customer settings updated successfully.");
    } catch (nextError) {
      setCustomerMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update customer settings.",
      );
    } finally {
      setSavingCustomerSettings(false);
    }
  }

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (!event.latLng) {
      return;
    }

    const nextLat = event.latLng.lat();
    const nextLng = event.latLng.lng();
    const nextPosition = { lat: nextLat, lng: nextLng };
    setMarkerPosition(nextPosition);
    setCheckoutForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            lat: nextLat.toFixed(6),
            lng: nextLng.toFixed(6),
          }
        : currentForm,
    );

    if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: nextPosition }, (results) => {
        const result = results?.[0];
        if (!result) {
          return;
        }

        setCheckoutForm((currentForm) =>
          currentForm
            ? {
                ...currentForm,
                formattedAddress: result.formatted_address || currentForm.formattedAddress,
                line1: result.formatted_address || currentForm.line1,
              }
            : currentForm,
        );
      });
    }
  }, []);

  const handlePlaceChanged = useCallback(() => {
    const place = autocomplete?.getPlace();

    if (!place?.geometry?.location) {
      return;
    }

    const nextLat = place.geometry.location.lat();
    const nextLng = place.geometry.location.lng();
    const nextPosition = { lat: nextLat, lng: nextLng };
    setMarkerPosition(nextPosition);
    setCheckoutForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            formattedAddress: place.formatted_address || currentForm.formattedAddress,
            line1: place.formatted_address || currentForm.line1,
            lat: nextLat.toFixed(6),
            lng: nextLng.toFixed(6),
          }
        : currentForm,
    );
    mapInstance?.panTo(nextPosition);
  }, [autocomplete, mapInstance]);

  async function handleAddCartItem(productId: string) {
    const quantity = Number(quantityDrafts[productId] || 1);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCartMessage("Quantity must be greater than zero.");
      return;
    }

    setAddingProductId(productId);
    setCartMessage(null);

    try {
      const response =
        await authorizedRequest<
          ApiResponse<{ customer: AdminCustomer; cart: AdminCustomerCart }>
        >(`/admin/customers/${customerId}/cart/items`, {
          method: "POST",
          body: JSON.stringify({
            productId,
            quantity,
          }),
        });

      setCustomer(response.data.customer);
      setCart(response.data.cart);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
      setQuantityDrafts((currentDrafts) => ({
        ...currentDrafts,
        [productId]: "1",
      }));
      setCartMessage("Item added to customer cart successfully.");
      setCheckoutPreview(null);
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
    } catch (nextError) {
      setCartMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to add item to customer cart.",
      );
    } finally {
      setAddingProductId(null);
    }
  }

  async function handleUpdateCartItem(itemId: string) {
    const quantity = Number(cartItemQuantityDrafts[itemId]);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCartMessage("Cart quantity must be greater than zero.");
      return;
    }

    setUpdatingCartItemId(itemId);
    setCartMessage(null);

    try {
      const response =
        await authorizedRequest<
          ApiResponse<{ customer: AdminCustomer; cart: AdminCustomerCart }>
        >(`/admin/customers/${customerId}/cart/items/${encodeURIComponent(itemId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            quantity,
          }),
        });

      setCustomer(response.data.customer);
      setCart(response.data.cart);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
      setCartMessage("Cart item quantity updated successfully.");
      setCheckoutPreview(null);
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
    } catch (nextError) {
      setCartMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update cart item quantity.",
      );
    } finally {
      setUpdatingCartItemId(null);
    }
  }

  async function handleRemoveCartItem(itemId: string) {
    setRemovingCartItemId(itemId);
    setCartMessage(null);

    try {
      const response =
        await authorizedRequest<
          ApiResponse<{ customer: AdminCustomer; cart: AdminCustomerCart }>
        >(`/admin/customers/${customerId}/cart/items/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
        });

      setCustomer(response.data.customer);
      setCart(response.data.cart);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
      setCartMessage("Cart item removed successfully.");
      setCheckoutPreview(null);
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
    } catch (nextError) {
      setCartMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to remove cart item.",
      );
    } finally {
      setRemovingCartItemId(null);
    }
  }

  async function handlePreviewCheckout() {
    if (!checkoutForm) {
      return;
    }

    setPreviewingCheckout(true);
    setCheckoutMessage(null);

    try {
      const response =
        await authorizedRequest<
          ApiResponse<{
            customer: AdminCustomer;
            cart: AdminCustomerCart;
            preview: AdminCheckoutPreview;
          }>
        >(`/admin/customers/${customerId}/cart/checkout/preview`, {
          method: "POST",
          body: JSON.stringify(buildCheckoutPayload(checkoutForm)),
        });

      setCustomer(response.data.customer);
      setCart(response.data.cart);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
      setCheckoutPreview(response.data.preview);
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
      setCheckoutMessage(
        response.data.preview.appliedCoupon?.code
          ? `Coupon ${response.data.preview.appliedCoupon.code} applied successfully.`
          : "Checkout payable preview generated successfully.",
      );
    } catch (nextError) {
      setCheckoutPreview(null);
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
      setCheckoutMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to generate checkout preview.",
      );
    } finally {
      setPreviewingCheckout(false);
    }
  }

  async function handleCreatePaymentCheckout() {
    if (!checkoutForm) {
      return;
    }

    setCreatingCheckout(true);
    setCheckoutMessage(null);

    try {
      const response =
        await authorizedRequest<
          ApiResponse<{
            customer: AdminCustomer;
            cart: AdminCustomerCart;
            checkout: AdminPaymentCheckout;
          }>
        >(`/admin/customers/${customerId}/cart/checkout/payment`, {
          method: "POST",
          body: JSON.stringify(buildCheckoutPayload(checkoutForm)),
        });

      setCustomer(response.data.customer);
      setCart(response.data.cart);
      setCartItemQuantityDrafts(buildCartItemQuantityDrafts(response.data.cart));
      setActiveCheckout(response.data.checkout);
      setActivePaymentAttempt({
        id: response.data.checkout.paymentAttemptId,
        paymentAttemptId: response.data.checkout.paymentAttemptId,
        status: response.data.checkout.status,
        statusLabel: response.data.checkout.statusLabel,
        orderId: null,
        amount: response.data.checkout.amount,
        currency: response.data.checkout.currency,
        paymentMethod: checkoutForm.paymentMethod,
        paymentMethodLabel:
          checkoutForm.paymentMethod === "emi" ? "EMI" : "Online payment",
        redirectUrl: response.data.checkout.redirectUrl,
        paymentSessionId: response.data.checkout.paymentSessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setCheckoutMessage(
        response.data.checkout.provider === "cashfree"
          ? "Payment transaction created. Open Cashfree checkout and let the customer complete payment."
          : "Payment transaction created. Ask the customer to scan the QR and complete payment.",
      );
    } catch (nextError) {
      setActiveCheckout(null);
      setActivePaymentAttempt(null);
      setCheckoutMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create customer payment transaction.",
      );
    } finally {
      setCreatingCheckout(false);
    }
  }

  async function handleCopyPaymentLink() {
    if (!activeCheckout?.redirectUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeCheckout.redirectUrl);
      setCheckoutMessage("Payment link copied successfully.");
    } catch {
      setCheckoutMessage("Unable to copy payment link on this device.");
    }
  }

  async function handleOpenCashfreeCheckout() {
    if (!activeCheckout?.paymentSessionId) {
      return;
    }

    try {
      await loadCashfreeScript();

      if (!window.Cashfree) {
        throw new Error("Cashfree checkout is unavailable right now.");
      }

      const cashfree = window.Cashfree({
        mode: activeCheckout.mode as "sandbox" | "production",
      });

      await cashfree.checkout({
        paymentSessionId: activeCheckout.paymentSessionId,
        redirectTarget: "_self",
        returnUrl: activeCheckout.returnUrl,
      });
    } catch (nextError) {
      setCheckoutMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to open Cashfree checkout.",
      );
    }
  }

  if (loading) {
    return <AdminLoadingCard label="Loading customer details..." />;
  }

  if (error || !customer || !checkoutForm) {
    return (
      <AdminErrorCard message={error || "Customer not found."} onRetry={loadCustomer} />
    );
  }

  const filteredProducts = products.filter((product) =>
    [product.name, product.productId, product.category, product.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(cartAddForm.productQuery.trim().toLowerCase()),
  );

  const availableGatewayMethods: Array<{
    value: "online_payment" | "emi";
    label: string;
  }> = [
    customer.paymentAccess.onlinePayment
      ? { value: "online_payment" as const, label: "Online payment" }
      : null,
    customer.paymentAccess.emi ? { value: "emi" as const, label: "EMI" } : null,
  ].filter(
    (
      method,
    ): method is {
      value: "online_payment" | "emi";
      label: string;
    } => Boolean(method),
  );
  const couponDiscountValue = Number(checkoutPreview?.pricing.couponDiscountValue || 0);
  const isQrProvider = activeCheckout?.provider === "phonepe" && Boolean(activeCheckout.redirectUrl);
  const qrImageUrl = activeCheckout?.redirectUrl
    ? buildQrImageUrl(activeCheckout.redirectUrl)
    : "";
  const displayedSubtotal = checkoutPreview?.pricing.itemsSubtotal ?? cart?.summary.subtotal ?? 0;
  const displayedDeliveryCharge = checkoutPreview?.pricing.deliveryCharge ?? 0;
  const displayedPayable = checkoutPreview?.pricing.total ?? cart?.summary.subtotal ?? 0;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Cart Assignment"
        title={customer.fullName}
        description="Assign products, prepare delivery checkout, apply coupon, and create a payment QR for this customer from one workspace."
      />

      <div className="space-y-6">
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--admin-ink)]">
                {customer.email || "No email"}
              </p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                {customer.phoneNumber || "No phone"} | Joined {formatAdminDate(customer.createdAt)}
              </p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                {customer.customerCategory.replaceAll("_", " ")} | {customer.authProvider}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminStatusPill status={customer.accountStatus} />
              {customer.isVip ? (
                <span className="inline-flex items-center rounded-full bg-[#f5edc4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7b5b08]">
                  VIP
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/customers"
              className="inline-flex items-center justify-center rounded-full border border-[var(--admin-line-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)]"
            >
              Back to customers
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] pb-4">
            <div>
              <h3 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                Customer Settings
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                Mark this customer as VIP and manage the business category used across the storefront.
              </p>
            </div>
            <AdminActionButton
              type="button"
              tone="primary"
              onClick={() => void handleSaveCustomerSettings()}
              disabled={savingCustomerSettings || !customerSettingsForm}
            >
              {savingCustomerSettings ? "Saving..." : "Save settings"}
            </AdminActionButton>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,280px)]">
            <label className="inline-flex items-center gap-3 rounded-[1rem] border border-[var(--admin-line)] bg-[#f8faf6] px-4 py-3 text-sm font-semibold text-[var(--admin-ink)]">
              <input
                type="checkbox"
                checked={Boolean(customerSettingsForm?.isVip)}
                onChange={(event) =>
                  setCustomerSettingsForm((currentForm) =>
                    currentForm
                      ? {
                          ...currentForm,
                          isVip: event.target.checked,
                        }
                      : currentForm,
                  )
                }
              />
              Mark as VIP
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                Customer category
              </p>
              <AdminSelect
                value={customerSettingsForm?.customerCategory || "normal"}
                onChange={(event) =>
                  setCustomerSettingsForm((currentForm) =>
                    currentForm
                      ? {
                          ...currentForm,
                          customerCategory: event.target.value as AdminCustomer["customerCategory"],
                        }
                      : currentForm,
                  )
                }
              >
                <option value="normal">Normal</option>
                <option value="nursery_owner">Nursery owner</option>
                <option value="garden_contractor">Garden contractor</option>
              </AdminSelect>
            </div>
          </div>

          {customerMessage ? (
            <div className="mt-4 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-ink)]">
              {customerMessage}
            </div>
          ) : null}
        </AdminPanel>

        <AdminPanel id="cart">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] pb-4">
            <div>
              <h3 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                Customer Cart Checkout
              </h3>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                Build the customer cart, set delivery details, preview payable charges, and create a QR-based payment transaction.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AdminStatusPill status={customer.accountStatus} />
              {customer.paymentAccess.onlinePayment ? (
                <span className="inline-flex items-center rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#3257a8]">
                  Online enabled
                </span>
              ) : null}
              {customer.paymentAccess.emi ? (
                <span className="inline-flex items-center rounded-full bg-[#fff3df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#946100]">
                  EMI enabled
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white">
                <div className="border-b border-[var(--admin-line)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-ink)]">
                        Added items
                      </p>
                      <p className="mt-1 text-xs text-[var(--admin-muted)]">
                        Cart lines and running price preview.
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--admin-chip)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      {cart?.summary.itemCount || 0} items
                    </span>
                  </div>
                </div>
                {!cart?.items?.length ? (
                  <div className="px-4 py-5 text-sm text-[var(--admin-muted)]">
                    No items in this customer cart yet.
                  </div>
                ) : (
                  <div className="space-y-3 px-4 py-4">
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--admin-ink)]">
                              {item.name}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Qty {item.quantity}
                              {item.packLabel ? ` | ${item.packLabel}` : ""}
                              {item.category ? ` | ${item.category}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--admin-ink)]">
                              {formatAdminCurrency(item.unitPrice || 0)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--admin-muted)]">
                              Line {formatAdminCurrency((item.unitPrice || 0) * item.quantity)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-end gap-3">
                          <div className="min-w-[110px]">
                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                              Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={cartItemQuantityDrafts[item.id] ?? String(item.quantity)}
                              onChange={(event) =>
                                setCartItemQuantityDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className={inputClassName()}
                            />
                          </div>
                          <AdminActionButton
                            type="button"
                            tone="secondary"
                            disabled={
                              updatingCartItemId === item.id || removingCartItemId === item.id
                            }
                            onClick={() => void handleUpdateCartItem(item.id)}
                          >
                            {updatingCartItemId === item.id ? "Updating..." : "Update"}
                          </AdminActionButton>
                          <AdminActionButton
                            type="button"
                            tone="danger"
                            disabled={
                              removingCartItemId === item.id || updatingCartItemId === item.id
                            }
                            onClick={() => void handleRemoveCartItem(item.id)}
                          >
                            {removingCartItemId === item.id ? "Removing..." : "Remove"}
                          </AdminActionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                  Charges
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-[var(--admin-muted)]">
                    <span>Items in cart</span>
                    <span className="font-semibold text-[var(--admin-ink)]">
                      {cart?.summary.itemCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--admin-muted)]">
                    <span>Total quantity</span>
                    <span className="font-semibold text-[var(--admin-ink)]">
                      {cart?.summary.totalQuantity || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--admin-muted)]">
                    <span>Product subtotal</span>
                    <span className="font-semibold text-[var(--admin-ink)]">
                      {formatAdminCurrency(displayedSubtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--admin-muted)]">
                    <span>Delivery charge</span>
                    <span className="font-semibold text-[var(--admin-ink)]">
                      {formatAdminCurrency(displayedDeliveryCharge)}
                    </span>
                  </div>
                  {checkoutPreview?.appliedCoupon?.code ? (
                    <div className="flex items-center justify-between text-sm text-[#2d6a31]">
                      <span>Coupon ({checkoutPreview.appliedCoupon.code})</span>
                      <span className="font-semibold">
                        -{formatAdminCurrency(couponDiscountValue)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-[var(--admin-line)] pt-3 text-sm">
                    <span className="font-semibold text-[var(--admin-ink)]">Payable total</span>
                    <span className="text-base font-black text-[var(--admin-accent)]">
                      {formatAdminCurrency(displayedPayable)}
                    </span>
                  </div>
                </div>

                {checkoutPreview ? (
                  <div className="mt-4 rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3 text-xs leading-6 text-[var(--admin-muted)]">
                    <p>Distance: {checkoutPreview.pricing.distanceKm.toFixed(2)} km</p>
                    <p>Chargeable weight: {checkoutPreview.summary.totalWeightKg} kg</p>
                    <p>Suggested delivery: {formatAdminDate(checkoutPreview.suggestedDeliveryDate)}</p>
                  </div>
                ) : null}
              </div>

              {activeCheckout ? (
                <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
                        {isQrProvider ? "Payment QR" : "Payment checkout"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--admin-ink)]">
                        {isQrProvider
                          ? `Scan to pay ${formatAdminCurrency(activeCheckout.amount)}`
                          : `Complete ${activeCheckout.provider} payment for ${formatAdminCurrency(activeCheckout.amount)}`}
                      </p>
                    </div>
                    <AdminStatusPill status={activePaymentAttempt?.status || activeCheckout.status} />
                  </div>

                  {isQrProvider ? (
                    <div className="mt-4 flex justify-center rounded-[1rem] border border-[var(--admin-line)] bg-[#fbfdf8] p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImageUrl}
                        alt="Customer payment QR"
                        className="h-[220px] w-[220px] rounded-[0.75rem]"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1rem] border border-[var(--admin-line)] bg-[#fbfdf8] px-4 py-5 text-sm text-[var(--admin-muted)]">
                      Cashfree uses a hosted checkout session instead of a direct QR image in this admin workspace.
                    </div>
                  )}

                  <div className="mt-4 space-y-2 text-sm text-[var(--admin-muted)]">
                    <p>
                      Transaction:{" "}
                      <span className="font-semibold text-[var(--admin-ink)]">
                        {activeCheckout.paymentAttemptId}
                      </span>
                    </p>
                    <p>
                      Method:{" "}
                      <span className="font-semibold text-[var(--admin-ink)]">
                        {activePaymentAttempt?.paymentMethodLabel ||
                          (checkoutForm.paymentMethod === "emi" ? "EMI" : "Online payment")}
                      </span>
                    </p>
                    {activePaymentAttempt?.orderId ? (
                      <p>
                        Order created:{" "}
                        <Link
                          href={`/orders/${activePaymentAttempt.orderId}`}
                          className="font-semibold text-[var(--admin-accent)]"
                        >
                          Open order
                        </Link>
                      </p>
                    ) : null}
                    {activePaymentAttempt?.failureReason ? (
                      <p className="font-medium text-[#a73d31]">
                        {activePaymentAttempt.failureReason}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {activeCheckout.redirectUrl ? (
                      <>
                        <AdminActionButton
                          type="button"
                          tone="secondary"
                          onClick={() => void handleCopyPaymentLink()}
                        >
                          Copy payment link
                        </AdminActionButton>
                        <a
                          href={activeCheckout.redirectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                        >
                          Open payment page
                        </a>
                      </>
                    ) : null}
                    {activeCheckout.provider === "cashfree" ? (
                      <AdminActionButton
                        type="button"
                        tone="primary"
                        onClick={() => void handleOpenCashfreeCheckout()}
                      >
                        Open Cashfree checkout
                      </AdminActionButton>
                    ) : null}
                  </div>

                  {pollingPaymentAttempt ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      Refreshing payment status...
                    </p>
                  ) : null}
                </div>
              ) : null}
            </aside>

            <section className="space-y-4">
              <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4">
                <div className="border-b border-[var(--admin-line)] pb-4">
                  <h4 className="text-lg font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                    Assisted Checkout
                  </h4>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">
                    Enter delivery location, optionally apply coupon, preview charges, and create a QR payment transaction for the customer.
                  </p>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[#fbfdf8] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--admin-ink)]">
                          Delivery location
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">
                          Use the popup map picker to select the exact delivery point for distance and charge calculation.
                        </p>
                      </div>
                      <AdminActionButton
                        type="button"
                        tone="secondary"
                        onClick={() => setIsMapModalOpen(true)}
                      >
                        Select on map
                      </AdminActionButton>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                          Selected address
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                          {checkoutForm.formattedAddress || "No map location selected yet."}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                          Coordinates
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
                          {checkoutForm.lat || "--"}, {checkoutForm.lng || "--"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormGrid>
                    <FormField label="Billing name">
                      <input
                        value={checkoutForm.billingName}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, billingName: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Billing full name"
                      />
                    </FormField>
                    <FormField label="Billing contact">
                      <input
                        value={checkoutForm.billingContact}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, billingContact: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Valid billing phone number"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField label="Billing email">
                      <input
                        type="email"
                        value={checkoutForm.billingEmail}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, billingEmail: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Billing email address"
                      />
                    </FormField>
                    <FormField label="Formatted address">
                      <input
                        value={checkoutForm.formattedAddress}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, formattedAddress: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Full delivery address"
                      />
                    </FormField>
                    <FormField label="Address line 1">
                      <input
                        value={checkoutForm.line1}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, line1: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Primary delivery line"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField label="Address line 2">
                      <input
                        value={checkoutForm.line2}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, line2: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Secondary delivery line"
                      />
                    </FormField>
                    <FormField label="Landmark">
                      <input
                        value={checkoutForm.landmark}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, landmark: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Nearby landmark"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField label="City">
                      <input
                        value={checkoutForm.city}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, city: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="City"
                      />
                    </FormField>
                    <FormField label="State">
                      <input
                        value={checkoutForm.state}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, state: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="State"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField label="Postal code">
                      <input
                        value={checkoutForm.postalCode}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, postalCode: event.target.value }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Postal code"
                      />
                    </FormField>
                    <FormField label="Coupon code">
                      <input
                        value={checkoutForm.couponCode}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, couponCode: event.target.value.toUpperCase() }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        placeholder="Optional coupon code"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField
                      label="Delivery latitude"
                      hint="Required so the server can calculate delivery distance and charge."
                    >
                      <input
                        value={checkoutForm.lat}
                        onChange={(event) =>
                          {
                            const nextValue = event.target.value;
                            setCheckoutForm((currentForm) =>
                              currentForm ? { ...currentForm, lat: nextValue } : currentForm,
                            );
                            const nextLat = Number(nextValue);
                            const nextLng = Number(checkoutForm.lng);
                            if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
                              setMarkerPosition({ lat: nextLat, lng: nextLng });
                            }
                          }
                        }
                        className={inputClassName()}
                        placeholder="26.123456"
                      />
                    </FormField>
                    <FormField label="Delivery longitude">
                      <input
                        value={checkoutForm.lng}
                        onChange={(event) =>
                          {
                            const nextValue = event.target.value;
                            setCheckoutForm((currentForm) =>
                              currentForm ? { ...currentForm, lng: nextValue } : currentForm,
                            );
                            const nextLat = Number(checkoutForm.lat);
                            const nextLng = Number(nextValue);
                            if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
                              setMarkerPosition({ lat: nextLat, lng: nextLng });
                            }
                          }
                        }
                        className={inputClassName()}
                        placeholder="91.123456"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid>
                    <FormField label="Payment option">
                      <select
                        value={checkoutForm.paymentMethod}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? {
                                  ...currentForm,
                                  paymentMethod: event.target.value as "online_payment" | "emi",
                                }
                              : currentForm,
                          )
                        }
                        className={inputClassName()}
                        disabled={!availableGatewayMethods.length}
                      >
                        {availableGatewayMethods.length ? (
                          availableGatewayMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))
                        ) : (
                          <option value="online_payment">No gateway payment access</option>
                        )}
                      </select>
                    </FormField>
                    <FormField label="Delivery notes">
                      <textarea
                        value={checkoutForm.notes}
                        onChange={(event) =>
                          setCheckoutForm((currentForm) =>
                            currentForm
                              ? { ...currentForm, notes: event.target.value }
                              : currentForm,
                          )
                        }
                        className={textareaClassName()}
                        placeholder="Optional delivery instructions"
                      />
                    </FormField>
                  </FormGrid>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <AdminActionButton
                    type="button"
                    tone="secondary"
                    onClick={() => void handlePreviewCheckout()}
                    disabled={!cart?.items.length || previewingCheckout}
                  >
                    {previewingCheckout ? "Previewing..." : "Preview payable"}
                  </AdminActionButton>
                  <AdminActionButton
                    type="button"
                    tone="primary"
                    onClick={() => void handleCreatePaymentCheckout()}
                    disabled={!cart?.items.length || !availableGatewayMethods.length || creatingCheckout}
                  >
                    {creatingCheckout
                      ? "Generating..."
                      : checkoutForm.paymentMethod === "emi"
                        ? "Generate gateway checkout"
                        : "Generate payment checkout"}
                  </AdminActionButton>
                </div>

                {!availableGatewayMethods.length ? (
                  <div className="mt-4 rounded-[1rem] border border-[#f2d6d1] bg-[#fff7f5] px-4 py-3 text-sm font-medium text-[#a14a3b]">
                    This customer does not currently have online payment or EMI access enabled.
                  </div>
                ) : null}

                {checkoutMessage ? (
                  <div className="mt-4 rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-ink)]">
                    {checkoutMessage}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="w-full max-w-xl">
                    <p className="mb-2 text-sm font-semibold text-[var(--admin-ink)]">
                      Search product
                    </p>
                    <input
                      onChange={(event) =>
                        setCartAddForm((current) => ({
                          ...current,
                          productQuery: event.target.value,
                        }))
                      }
                      value={cartAddForm.productQuery}
                      className={inputClassName()}
                      placeholder="Search by name, product id, or category"
                    />
                  </div>
                  <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-muted)]">
                    Showing{" "}
                    <span className="font-semibold text-[var(--admin-ink)]">
                      {filteredProducts.length}
                    </span>{" "}
                    products
                  </div>
                </div>
              </div>

              {cartMessage ? (
                <div className="rounded-[1rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-4 py-3 text-sm text-[var(--admin-ink)]">
                  {cartMessage}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[1rem] border border-[var(--admin-line)] bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--admin-line)] bg-[#f8faf6] text-left">
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Product
                        </th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Category
                        </th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Stock
                        </th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Price
                        </th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length ? (
                        filteredProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="border-b border-[var(--admin-line)] align-top transition hover:bg-[#fbfdf8]"
                          >
                            <td className="px-4 py-4">
                              <div className="min-w-[280px]">
                                <p className="text-sm font-bold text-[var(--admin-ink)]">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                                  {product.productId}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[140px] text-sm text-[var(--admin-muted)]">
                                {product.category}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[90px] text-sm font-semibold text-[var(--admin-ink)]">
                                {product.stock}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[110px] text-sm font-semibold text-[var(--admin-ink)]">
                                {formatAdminCurrency(product.price)}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[110px]">
                                <input
                                  type="number"
                                  min="1"
                                  value={quantityDrafts[product.id] || "1"}
                                  onChange={(event) =>
                                    setQuantityDrafts((currentDrafts) => ({
                                      ...currentDrafts,
                                      [product.id]: event.target.value,
                                    }))
                                  }
                                  className={inputClassName()}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="min-w-[120px]">
                                <AdminActionButton
                                  type="button"
                                  tone="primary"
                                  disabled={addingProductId === product.id}
                                  onClick={() => void handleAddCartItem(product.id)}
                                >
                                  {addingProductId === product.id ? "Adding..." : "Add to cart"}
                                </AdminActionButton>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-sm text-[var(--admin-muted)]"
                          >
                            No products match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </AdminPanel>
      </div>

      {isMapModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(15,24,12,0.42)] p-4">
          <div className="w-full max-w-4xl rounded-[1.2rem] border border-[var(--admin-line)] bg-white p-5 shadow-[0_20px_60px_rgba(18,43,16,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-line)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Delivery Map
                </p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
                  Select delivery location
                </h3>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  Search the address or drop the pin to update delivery coordinates and address.
                </p>
              </div>
              <AdminActionButton
                type="button"
                tone="secondary"
                onClick={() => setIsMapModalOpen(false)}
              >
                Close
              </AdminActionButton>
            </div>

            <div className="mt-5">
              {isMapLoaded ? (
                <div className="space-y-4">
                  <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
                    <input
                      value={checkoutForm.formattedAddress}
                      onChange={(event) =>
                        setCheckoutForm((currentForm) =>
                          currentForm
                            ? {
                                ...currentForm,
                                formattedAddress: event.target.value,
                                line1: currentForm.line1 || event.target.value,
                              }
                            : currentForm,
                        )
                      }
                      className={inputClassName()}
                      placeholder="Search delivery address on map"
                    />
                  </Autocomplete>

                  <div className="overflow-hidden rounded-[1rem] border border-[var(--admin-line)]">
                    <GoogleMap
                      mapContainerStyle={{ width: "100%", height: "420px" }}
                      center={markerPosition}
                      zoom={12}
                      onClick={handleMapClick}
                      onLoad={setMapInstance}
                      options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        streetViewControl: false,
                      }}
                    >
                      <Marker position={markerPosition} />
                    </GoogleMap>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[var(--admin-line-strong)] bg-white px-4 py-5 text-sm text-[var(--admin-muted)]">
                  {mapLoadError
                    ? "Google Maps failed to load for the admin panel."
                    : "Google Maps is loading. If this stays empty, add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to the admin panel env."}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
