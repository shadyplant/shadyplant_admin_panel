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
      className={`rounded-[1rem] border border-[var(--admin-line)] bg-white p-4 shadow-[0_6px_18px_rgba(18,43,16,0.04)] ${className}`}
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
    <div className="rounded-[1rem] border border-[var(--admin-line)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--admin-ink)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{meta}</p>
    </div>
  );
}

export function AdminPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
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
    <div className="flex flex-col gap-3 border-b border-[var(--admin-line)] pb-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--admin-ink)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--admin-muted)]">
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
      className={`w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)] ${props.className || ""}`}
    />
  );
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)] ${props.className || ""}`}
    />
  );
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[140px] w-full rounded-[1rem] border border-[var(--admin-line-strong)] bg-white px-4 py-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[#8a9b88] focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)] ${props.className || ""}`}
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
      ? "bg-[var(--admin-accent)] text-white hover:brightness-95"
      : tone === "danger"
        ? "border border-[#edc1bb] bg-[#fff4f2] text-[#9d3b2d] hover:bg-[#fff0ed]"
        : "border border-[var(--admin-line-strong)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-chip)]";

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
          className="rounded-[1rem] bg-[var(--admin-chip)] px-4 py-3"
        >
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm leading-6 text-[var(--admin-ink)]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
