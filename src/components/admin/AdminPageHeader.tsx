import Link from "next/link";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--admin-line)] pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--admin-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[var(--admin-ink)]">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--admin-muted)] md:text-base">
          {description}
        </p>
      </div>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
