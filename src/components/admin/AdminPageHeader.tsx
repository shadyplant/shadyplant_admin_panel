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
  description = "",
  actionLabel,
  actionHref,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--admin-line)] pb-4 md:flex-row md:items-end md:justify-between">
      <div>
      
        <h1 className="mt-1.5 text-2xl text-[var(--admin-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm">{description}</p>
        ) : null}
      </div>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-full bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
