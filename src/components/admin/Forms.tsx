import type { ReactNode } from "react";

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>;
}

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--admin-ink)]">
        {label}
      </span>
      {hint ? (
        <span className="mt-1 block text-xs leading-5 text-[var(--admin-muted)]">
          {hint}
        </span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function inputClassName() {
  return "w-full rounded-sm border border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 outline-none transition placeholder:text-gray-500 focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[var(--admin-accent-soft)]";
}

export function textareaClassName() {
  return `${inputClassName()} min-h-[140px] resize-y`;
}
