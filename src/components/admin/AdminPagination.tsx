type AdminPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

export default function AdminPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  label,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [6, 8, 12, 24],
}: AdminPaginationProps) {
  const startItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[var(--admin-line)] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-[var(--admin-muted)]">
        Showing <span className="font-semibold text-[var(--admin-ink)]">{startItem}</span>
        {" - "}
        <span className="font-semibold text-[var(--admin-ink)]">{endItem}</span> of{" "}
        <span className="font-semibold text-[var(--admin-ink)]">{totalItems}</span> {label}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-[var(--admin-muted)]">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-full border border-[var(--admin-line-strong)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)]"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-full border border-[var(--admin-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Previous
          </button>
          <span className="text-sm font-semibold text-[var(--admin-muted)]">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-[var(--admin-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--admin-ink)] transition hover:bg-[var(--admin-chip)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
