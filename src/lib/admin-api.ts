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
  name: string;
  category: string;
  price: number;
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
  videoClips: AdminProductVideoClip[];
  tags: string[];
  optionGroups: AdminProductOptionGroup[];
  stockAlertCount: number;
  stockAlerts?: AdminProductStockAlert[];
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

export type AdminReview = {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  authorName: string;
  authorLocation: string;
  verifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
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
  currentStatus?: string;
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

export type AdminCustomer = {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  authProvider: string;
  profileImage?: string | null;
  isVerified: boolean;
  deliveryAddress: Record<string, unknown>;
  billingDetails: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
