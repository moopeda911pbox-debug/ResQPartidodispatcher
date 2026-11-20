import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [25, 50, 75, 100];

/**
 * Client-side paging with a rows-per-page limit (25 / 50 / 75 / 100).
 * `resetKey` — change it (e.g. when a filter changes) to jump back to page 1.
 */
export function usePagination(rows, { resetKey = "", initialSize = PAGE_SIZES[0] } = {}) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;

  const slice = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  return {
    slice,
    page: current,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}

export default function Pagination({ pager, noun = "rows" }) {
  if (pager.total === 0) return null;
  return (
    <div className="pager">
      <label className="pager-size">
        Rows per page
        <select value={pager.pageSize} onChange={(e) => pager.setPageSize(Number(e.target.value))}>
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span className="pager-range">
        {pager.from}–{pager.to} of {pager.total} {noun}
      </span>
      <div className="pager-nav">
        <button
          type="button"
          className="btn-mini"
          disabled={pager.page <= 1}
          onClick={() => pager.setPage(pager.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={13} style={{ verticalAlign: -2 }} /> Prev
        </button>
        <span className="pager-page">Page {pager.page} of {pager.totalPages}</span>
        <button
          type="button"
          className="btn-mini"
          disabled={pager.page >= pager.totalPages}
          onClick={() => pager.setPage(pager.page + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight size={13} style={{ verticalAlign: -2 }} />
        </button>
      </div>
    </div>
  );
}
