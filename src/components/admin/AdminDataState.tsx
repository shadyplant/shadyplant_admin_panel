export function AdminLoadingCard({ label }: { label: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--admin-line)] bg-[var(--admin-chip)] px-5 py-6 text-sm font-semibold text-[var(--admin-muted)]">
      {label}
    </div>
  );
}

export function AdminErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#f1c7c3] bg-[#fff6f4] px-5 py-6">
      <p className="text-sm font-semibold text-[#a73d31]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-[#e3b2ac] px-4 py-2 text-sm font-semibold text-[#8d342b] transition hover:bg-white"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function AdminEmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-lg font-bold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
        {description}
      </p>
    </div>
  );
}
