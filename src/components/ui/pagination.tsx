"use client";

import Link from "next/link";
import { Button } from "./button";

type PaginationProps = {
  totalPages: number;
  currentPage: number;
} & (
  | { onPageChangeAction: (page: number) => void; hrefOf?: undefined }
  /** Pages as links (ctrl-click, crawlable); the disabled ends stay buttons. */
  | { hrefOf: (page: number) => string; onPageChangeAction?: undefined }
);

interface PageControlProps {
  page: number;
  label: string | number;
  variant: "secondary" | "ghost";
  current?: boolean;
  disabled?: boolean;
  hrefOf?: (page: number) => string;
  onPageChangeAction?: (page: number) => void;
}

/** One control: a link when `hrefOf` is given and it is enabled, else a button. */
function PageControl({ page, label, variant, current, disabled, hrefOf, onPageChangeAction }: PageControlProps) {
  const shared = {
    variant,
    size: "sm" as const,
    className: typeof label === "number" ? "tabular-nums" : undefined,
    "aria-current": current ? ("page" as const) : undefined,
  };
  if (hrefOf && !disabled) {
    return (
      <Button asChild {...shared}>
        <Link href={hrefOf(page)}>{label}</Link>
      </Button>
    );
  }
  return (
    <Button {...shared} disabled={disabled} onClick={() => onPageChangeAction?.(page)}>
      {label}
    </Button>
  );
}

export function Pagination({ totalPages, currentPage, onPageChangeAction, hrefOf }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const nav = { hrefOf, onPageChangeAction };
  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <PageControl
        {...nav}
        page={Math.max(1, currentPage - 1)}
        label="Previous"
        variant="secondary"
        disabled={currentPage === 1}
      />
      {pages.map((p) => (
        <PageControl
          key={p}
          {...nav}
          page={p}
          label={p}
          variant={p === currentPage ? "secondary" : "ghost"}
          current={p === currentPage}
        />
      ))}
      <PageControl
        {...nav}
        page={Math.min(totalPages, currentPage + 1)}
        label="Next"
        variant="secondary"
        disabled={currentPage === totalPages}
      />
    </nav>
  );
}
