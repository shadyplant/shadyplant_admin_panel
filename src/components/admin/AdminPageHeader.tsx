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
    <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
      
        <h1 className="mt-1.5 text-2xl text-gray-800">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-600">
            {description}
          </p>
        ) : null}
      </div>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center rounded-full bg-[#207958] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
