export function formatAdminCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatAdminDate(value: string | number | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCompactDate(value: string | number | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function splitCommaSeparatedValues(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )];
}

export function toCommaSeparatedValue(values: string[] | null | undefined) {
  return Array.isArray(values) ? values.join(", ") : "";
}

export function safeJsonParse<T>(
  value: string,
  fallback: T,
  normalize?: (input: unknown) => T,
) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    return normalize ? normalize(parsedValue) : (parsedValue as T);
  } catch {
    return fallback;
  }
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function normalizeObjectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeObjectArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function resolveOrderTotal(pricing: Record<string, unknown> | null | undefined) {
  const source = pricing || {};
  const keys = [
    "grandTotal",
    "finalAmount",
    "totalAmount",
    "total",
    "payableAmount",
    "subtotal",
  ];

  for (const key of keys) {
    const amount = Number(source[key]);

    if (Number.isFinite(amount) && amount > 0) {
      return amount;
    }
  }

  return 0;
}

export function resolveDeliveryCharge(
  pricing: Record<string, unknown> | null | undefined,
) {
  const source = pricing || {};
  const keys = [
    "deliveryCharge",
    "shippingSubtotal",
    "transportCharge",
    "shippingCharge",
    "deliveryAmount",
  ];

  for (const key of keys) {
    const amount = Number(source[key]);

    if (Number.isFinite(amount) && amount >= 0) {
      return amount;
    }
  }

  return 0;
}

export function getStatusTone(status: string | null | undefined) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (["approved", "active", "paid", "delivered", "completed"].includes(normalizedStatus)) {
    return "bg-[#e6f5e7] text-[#246131]";
  }

  if (["pending", "processing", "shipped", "pay_on_delivery"].includes(normalizedStatus)) {
    return "bg-[#fff2de] text-[#9c5d1e]";
  }

  if (["rejected", "disabled", "cancelled", "failed"].includes(normalizedStatus)) {
    return "bg-[#fff0ee] text-[#a34132]";
  }

  return "bg-[var(--admin-chip)] text-[var(--admin-muted)]";
}

export function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim()[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
