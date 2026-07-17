import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { getStatusTone } from "@/lib/admin-utils";

export function AdminPanel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
}) {
  return (
    <section
      {...props}
      className={`rounded-xl p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-gray-800">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-gray-500">{meta}</p>
    </div>
  );
}

export function AdminPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-700">
      {children}
    </span>
  );
}

export function AdminStatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getStatusTone(status)}`}
    >
      {String(status || "unknown").replaceAll("_", " ")}
    </span>
  );
}

export function AdminSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e7e7e7] pb-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function AdminToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-center ${className}`}>
      {children}
    </div>
  );
}

export function AdminTextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-gray-500 focus:ring-4 focus:ring-gray-300 ${props.className || ""}`}
    />
  );
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-gray-500 focus:ring-4 focus:ring-gray-300 ${props.className || ""}`}
    />
  );
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[140px] w-full rounded-sm border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)] ${props.className || ""}`}
    />
  );
}

export function AdminActionButton({
  children,
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  const toneClassName =
    tone === "primary"
      ? "bg-[#207958] text-white hover:brightness-95"
      : tone === "danger"
        ? " bg-[#ffffff] text-[#9d3b2d] hover:bg-[#fff0ed]"
        : "border border-gray-300 bg-white text-gray-700 hover:bg-[#f3f4f6]";

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClassName} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminInfoList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-gray-100 px-4 py-3"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm leading-6 text-gray-900">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
