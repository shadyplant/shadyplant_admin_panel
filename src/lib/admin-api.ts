export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type AdminStaff = {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  organization?: Organization;
};

export type AdminProduct = {
  id: string;
  productId: string;
  sku: string;
  skuId: string;
  name: string;
  category: string;
  variety: string;
  containerSize: string;
  height: string;
  growthSpeed: string;
  countryOfOrigin: string;
  manufacturedBy: string;
  marketedBy: string;
  potMaterial: string;
  hsnCode: string;
  price: number;
  mrp: number;
  weight: number;
  offer: string;
  minOrderQuantity: number;
  stock: number;
  isOnTrend: boolean;
  isFeaturedLatest: boolean;
  packLabel: string;
  unit: string;
  badge: string;
  description: string;
  image: string;
  images: string[];
  usesImages: string[];
  videoClips: AdminProductVideoClip[];
  tags: string[];
  leafColor: string;
  flowerColor: string;
  lightRequirement: string;
  waterRequirement: string;
  plantPlacement: string;
  usageArea: string;
  plantAgeMonths: number | null;
  productionCapacity: number | null;
  packagingDetails: string;
  optionGroups: AdminProductOptionGroup[];
  detailSections: AdminProductDetailSection[];
  quantityPricingSlabs: AdminProductQuantityPricingSlab[];
  stockAlertCount: number;
  stockAlerts?: AdminProductStockAlert[];
};

export type AdminProductStockAdjustment = {
  operation: "add" | "adjust";
  quantity: number;
  delta: number;
  previousStock: number;
  currentStock: number;
  reason: string | null;
  note?: string | null;
  adjustedAt: string;
};

export type AdminProductStockAdjustmentLog = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  operation: string;
  quantity: number;
  delta: number;
  reason: string;
  note: string;
  previousStock: number;
  currentStock: number;
  actor: {
    staffAccountId: string;
    email: string;
    role: string;
  };
  createdAt: string;
  updatedAt?: string | null;
};

export type AdminProductStockAlert = {
  id: string;
  productId: string;
  userId: string;
  status: string;
  notifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  customer?: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    city: string;
  };
};

export type AdminProductVideoClip = {
  id: string;
  title: string;
  poster: string;
  src: string;
  views: string;
  products: number | null;
  isVideo: boolean;
};

export type AdminProductOption = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  note: string;
  price: number | null;
  mrp: number | null;
  stock: number | null;
  packLabel: string;
  weight: number | null;
  isDefault: boolean;
  isDisabled: boolean;
};

export type AdminProductOptionGroup = {
  key: string;
  title: string;
  subtitle: string;
  guideLabel: string;
  options: AdminProductOption[];
};

export type AdminProductDetailSection = {
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export type AdminProductQuantityPricingSlab = {
  key: string;
  label: string;
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: number;
  note: string;
};

export type AdminLawnGrassPageSettings = {
  productId: string;
  product: AdminProduct | null;
  updatedAt: string | null;
  updatedByStaffAccountId: string | null;
};

export type AdminShippingCountry = {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminShippingState = {
  id: string;
  countryId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminShippingRegion = {
  id: string;
  stateId: string;
  countryId: string | null;
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  defaultService: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminShippingRuleType =
  | "PIN"
  | "PIN_RANGE"
  | "CITY"
  | "DISTRICT"
  | "POLYGON"
  | "LATLNG";

export type AdminShippingRuleAction = "ALLOW" | "BLOCK";

export type AdminShippingRule = {
  id: string;
  shippingRegionId: string;
  countryId: string | null;
  countryCode: string;
  countryName: string;
  stateId: string | null;
  stateCode: string;
  stateName: string;
  action: AdminShippingRuleAction;
  ruleType: AdminShippingRuleType;
  pin: string;
  startPin: string;
  endPin: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminDeliveryChargeProfile = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminDeliveryChargeSlabCalculationMode =
  | "flat"
  | "per_distance"
  | "per_weight_unit";

export type AdminDeliveryChargeSlab = {
  id: string;
  profileId: string;
  profileCode: string;
  profileName: string;
  ruleKey: string;
  name: string;
  description: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
  calculationMode: AdminDeliveryChargeSlabCalculationMode;
  rate: number;
  weightUnitKg: number;
  minWeightKg: number | null;
  minWeightInclusive: boolean;
  maxWeightKg: number | null;
  maxWeightInclusive: boolean;
  minDistanceKm: number | null;
  minDistanceInclusive: boolean;
  maxDistanceKm: number | null;
  maxDistanceInclusive: boolean;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminService = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  badge: string;
  description: string;
  image: string;
  images: string[];
  tags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminHomeCategoryItem = {
  id: string;
  organizationId: string;
  itemKey: string;
  label: string;
  href: string;
  image: string;
  accentFrom: string;
  accentVia: string;
  accentTo: string;
  showOfferBadge: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminHomeSliderBanner = {
  id: string;
  organizationId: string;
  itemKey: string;
  title: string;
  actionType: "link" | "popup";
  href: string;
  popupKey: string;
  desktopImage: string;
  mobileImage: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminMediaUploadSession = {
  id: string;
  organizationId: string;
  createdByStaffAccountId?: string | null;
  entityType: string;
  entityId: string;
  slotKey: string;
  purpose: string;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  s3Key: string;
  publicUrl: string;
  status: "pending" | "uploaded" | "failed";
  expiresAt: string;
  uploadedAt?: string | null;
  completedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminMediaUploadSessionResponse = {
  session: AdminMediaUploadSession;
  signedUrl: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export type AdminReview = {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  body: string;
  status: string;
  authorName: string;
  authorLocation: string;
  verifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  adminReply?: {
    body: string;
    authorName: string;
    updatedAt?: string | null;
  } | null;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  trackingCode: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  deliveryAddress: Record<string, unknown>;
  deliveryDate: string;
  quantitySqft: number;
  distanceKm: number;
  vehicle: Record<string, unknown>;
  orderItems: Array<Record<string, unknown>>;
  billingDetails: Record<string, unknown>;
  deliveryLocation: Record<string, unknown>;
  paymentMethod: string;
  paymentMethodLabel?: string;
  paymentStatus: string;
  paymentStatusLabel?: string;
  paymentDetails?: Record<string, unknown>;
  refundAccountDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  } | null;
  refundRequestStatus?:
    | "pending_submission"
    | "submitted"
    | "resubmit_required"
    | "refunded"
    | null;
  refundRequestNote?: string;
  refundSubmittedAt?: string | null;
  refundResubmitRequestedAt?: string | null;
  currentStatus?: string;
  cancellationReason?: string;
  cancellationNote?: string;
  cancelledAt?: string | null;
  refundReason?: string;
  refundedAt?: string | null;
  pricing: Record<string, unknown>;
  trackingTimeline?: AdminOrderTrackingGroup[];
  recommendedItems?: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt?: string;
};

export type AdminOrderTrackingEntry = {
  id: string;
  message: string;
  timestamp: string;
};

export type AdminOrderTrackingGroup = {
  key: string;
  title: string;
  description: string;
  state: string;
  occurredAt?: string | null;
  entries: AdminOrderTrackingEntry[];
};

export type AdminTransaction = {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  trackingCode: string | null;
  paymentAttemptId: string | null;
  sourceType: string;
  sourceLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  receivedAmount: number;
  outstandingAmount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodLabel?: string | null;
  paymentStatus: string;
  paymentStatusLabel?: string | null;
  checkoutStatus?: string | null;
  checkoutStatusLabel?: string | null;
  currentStatus?: string | null;
  provider?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  failureReason?: string | null;
  lastWebhookEvent?: string | null;
  isMoneyReceived: boolean;
  createdAt: string;
  processedAt?: string | null;
  updatedAt?: string | null;
};

export type AdminTransactionSummary = {
  totalRecords: number;
  totalGrossAmount: number;
  totalReceivedAmount: number;
  totalOutstandingAmount: number;
  failedAmount: number;
  cashOnDeliveryAmount: number;
  onlineReceivedAmount: number;
  onlinePendingAmount: number;
};

export type AdminSalesReportItem = {
  sNo: number;
  itemName: string;
  hsnSac?: string | null;
  quantity: number;
  unit?: string | null;
  pricePerUnit: number;
  taxablePricePerUnit?: number;
  finalRate: number;
  discount?: number;
  discountPercent?: string | null;
  amount: number;
};

export type AdminSalesReportRow = {
  id: string;
  orderId: string;
  paymentAttemptId?: string | null;
  createdAt: string;
  date: string;
  orderNo?: string | number | null;
  invoiceNo: string | number;
  partyName: string;
  gstin?: string | null;
  partyPhone?: string | null;
  transactionType: string;
  total: number;
  paymentType?: string | null;
  received: number;
  balanceDue: number;
  dueDate?: string | null;
  status: "Paid" | "Overdue" | string;
  overdueDays?: number;
  items: AdminSalesReportItem[];
  discount?: number;
  discountPercent?: string | null;
  shippingCharge?: number;
  paymentStatus?: string | null;
  currentStatus?: string | null;
  provider?: string | null;
};

export type AdminSalesReportSummary = {
  totalRecords: number;
  totalSale: number;
  totalReceived: number;
  totalOutstanding: number;
  paidCount: number;
  overdueCount: number;
};

export type AdminSalesReportPayload = {
  generatedOn: string;
  durationFrom: string | null;
  durationTo: string | null;
  transactions: AdminSalesReportRow[];
  summary: AdminSalesReportSummary;
};

export type AdminCustomer = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  authProvider: string;
  profileImage?: string | null;
  isVerified: boolean;
  isVip: boolean;
  paymentAccess: {
    cashOnDelivery: boolean;
    onlinePayment: boolean;
    emi: boolean;
  };
  customerCategory: "normal" | "nursery_owner" | "garden_contractor";
  accountStatus: "active" | "banned_temporary" | "banned_permanent";
  bannedUntil?: string | null;
  banReason?: string;
  deliveryAddress: Record<string, unknown>;
  billingDetails: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerCartItem = {
  id: string;
  productId: string;
  variantId?: string;
  variantLabel?: string;
  packLabel?: string;
  name: string;
  image?: string;
  category?: string;
  quantity: number;
  unitPrice?: number | null;
  unitMrp?: number | null;
  currency?: string;
  addedAt?: string;
  updatedAt?: string;
};

export type AdminCustomerCart = {
  items: AdminCustomerCartItem[];
  summary: {
    itemCount: number;
    totalQuantity: number;
    subtotal: number;
    currency: string;
  };
  updatedAt?: string | null;
};

export type AdminCheckoutPreview = {
  summary: {
    itemCount: number;
    totalQuantity: number;
    totalWeightKg: number;
    itemsSubtotal: number;
    currency: string;
  };
  pricing: {
    itemsSubtotal: number;
    itemsSubtotalAfterCoupon?: number;
    deliveryCharge: number;
    totalBeforeCoupon?: number;
    total: number;
    couponCode?: string;
    couponType?: string;
    couponDiscountValue?: number;
    couponAdjustAmount?: number;
    couponDiscountPercent?: number;
    currency: string;
    distanceKm: number;
    deliveryRate: number;
    totalWeightKg: number;
  };
  deliveryChargeDetails: {
    message: string;
    rate: number;
    units: number | null;
  };
  suggestedDeliveryDate: string;
  appliedCoupon?: {
    id: string;
    code: string;
    type: "adjust" | "discount";
    adjustAmount: number;
    discountPercent: number;
    discountValue: number;
  } | null;
};

export type AdminPaymentCheckout = {
  paymentAttemptId: string;
  status: string;
  statusLabel: string;
  provider: string;
  merchantOrderId: string;
  gatewayOrderId: string;
  redirectUrl: string;
  paymentSessionId?: string;
  amount: number;
  currency: string;
  businessName: string;
  description: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  mode: string;
  returnUrl: string;
};

export type AdminPaymentAttempt = {
  id: string;
  paymentAttemptId: string;
  status: string;
  statusLabel: string;
  orderId: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodLabel?: string;
  failureReason?: string;
  provider?: string | null;
  merchantOrderId?: string | null;
  gatewayOrderId?: string | null;
  redirectUrl?: string;
  paymentSessionId?: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type AdminPaymentGatewayProviderProfile = {
  provider: string;
  label: string;
  isCheckoutConfigured: boolean;
  isWebhookConfigured: boolean;
};

export type AdminPaymentGatewaySettings = {
  activeProvider: string;
  defaultProvider: string;
  mode: string;
  providers: AdminPaymentGatewayProviderProfile[];
  updatedAt?: string | null;
  updatedByStaffAccountId?: string | null;
};

export type AdminCoupon = {
  id: string;
  code: string;
  type: "adjust" | "discount";
  status: "active" | "inactive" | "used" | "expired";
  effectiveStatus: "active" | "inactive" | "used" | "expired";
  adjustAmount: number;
  discountPercent: number;
  usageMode: "one_time";
  totalUsesAllowed: number;
  totalUsesRedeemed: number;
  isOneTimeUse: boolean;
  isRedeemed: boolean;
  redeemedByUserId?: string | null;
  redeemedOrderId?: string | null;
  redeemedAt?: string | null;
  expiresAt?: string | null;
  notes: string;
  createdByStaff?: {
    id: string;
    email: string;
    fullName: string;
  } | null;
  preview: {
    sampleProductTotal: number;
    sampleDeliveryCharge: number;
    sampleTotalPayable: number;
    discountValue: number;
    adjustedProductTotal: number;
    adjustedTotalPayable: number;
    appliesTo: "total_payable" | "product_total";
  };
  createdAt: string;
  updatedAt?: string | null;
};

export type ApiResponse<T> = {
  message: string;
  data: T;
};

const DEFAULT_ADMIN_API_BASE_URL = "http://localhost:8080/api/v1";

function isLocalHostname(hostname: string) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  );
}

function buildBrowserApiBaseUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_API_BASE_URL;
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:8080/api/v1`;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function buildSameOriginApiBaseUrl(pathname: string) {
  if (typeof window === "undefined") {
    return normalizeBaseUrl(pathname);
  }

  return normalizeBaseUrl(`${window.location.origin}${pathname}`);
}

function dedupeBaseUrls(urls: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const normalizedUrls: string[] = [];

  for (const url of urls) {
    const normalizedUrl = String(url || "").trim();

    if (!normalizedUrl || seen.has(normalizedUrl)) {
      continue;
    }

    seen.add(normalizedUrl);
    normalizedUrls.push(normalizedUrl);
  }

  return normalizedUrls;
}

export function getAdminApiBaseUrls() {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.trim() || "";

  if (!configuredBaseUrl) {
    return dedupeBaseUrls([
      typeof window === "undefined"
        ? DEFAULT_ADMIN_API_BASE_URL
        : buildBrowserApiBaseUrl(),
      DEFAULT_ADMIN_API_BASE_URL,
    ]);
  }

  if (configuredBaseUrl.startsWith("/")) {
    return dedupeBaseUrls([
      buildSameOriginApiBaseUrl(configuredBaseUrl),
      typeof window === "undefined" ? null : buildBrowserApiBaseUrl(),
      DEFAULT_ADMIN_API_BASE_URL,
    ]);
  }

  if (typeof window === "undefined") {
    return [normalizeBaseUrl(configuredBaseUrl)];
  }

  try {
    const parsedUrl = new URL(configuredBaseUrl);
    const normalizedConfiguredUrl = normalizeBaseUrl(configuredBaseUrl);

    if (!isLocalHostname(parsedUrl.hostname) || isLocalHostname(window.location.hostname)) {
      return dedupeBaseUrls([normalizedConfiguredUrl, DEFAULT_ADMIN_API_BASE_URL]);
    }

    parsedUrl.hostname = window.location.hostname;
    if (!parsedUrl.port) {
      parsedUrl.port = "8080";
    }

    return dedupeBaseUrls([
      normalizeBaseUrl(parsedUrl.toString()),
      normalizedConfiguredUrl,
      DEFAULT_ADMIN_API_BASE_URL,
    ]);
  } catch {
    return dedupeBaseUrls([
      buildSameOriginApiBaseUrl(configuredBaseUrl),
      buildBrowserApiBaseUrl(),
      DEFAULT_ADMIN_API_BASE_URL,
    ]);
  }
}

export function getAdminApiBaseUrl() {
  return getAdminApiBaseUrls()[0] || DEFAULT_ADMIN_API_BASE_URL;
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class AdminApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.data = data;
  }
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrls = getAdminApiBaseUrls();
  let lastError: AdminApiError | Error | null = null;

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        credentials: "include",
        headers,
      });

      const payload = await parseJson(response);

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : `Request failed with status ${response.status}`;

        const apiError = new AdminApiError(response.status, message, payload);
        const canRetryWithAnotherBaseUrl =
          response.status === 404 &&
          typeof message === "string" &&
          message.toLowerCase().includes("route not found") &&
          baseUrl !== baseUrls[baseUrls.length - 1];

        if (canRetryWithAnotherBaseUrl) {
          lastError = apiError;
          continue;
        }

        throw apiError;
      }

      return payload as T;
    } catch (error) {
      const isLastCandidate = baseUrl === baseUrls[baseUrls.length - 1];

      if (error instanceof AdminApiError) {
        lastError = error;

        if (!isLastCandidate) {
          continue;
        }

        throw error;
      }

      lastError = error instanceof Error ? error : new Error("Request failed.");

      if (!isLastCandidate) {
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Admin API request failed.");
}
