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
    <div className="flex flex-col gap-3 rounded-[1.2rem] bg-white px-4 py-2 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-600">{startItem}</span>
        {" - "}
        <span className="font-semibold text-gray-600">{endItem}</span> of{" "}
        <span className="font-semibold text-gray-600">{totalItems}</span> {label}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
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
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Previous
          </button>
          <span className="text-sm text-gray-800">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
