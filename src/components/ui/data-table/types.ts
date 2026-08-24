import type React from "react";

export type MobileRole = "hero" | "subtitle" | "badge" | "field" | "action" | "footer";

export type SortDirection = "asc" | "desc";

export interface SortState {
  columnKey: string;
  direction: SortDirection;
}

export interface FacetColumn<T> {
  /** Unique key identifying the column */
  key: string;
  /** Header label or custom ReactNode */
  header: string | React.ReactNode;
  /** Custom data extractor function */
  accessor?: (row: T) => any;
  /** Whether the column can be sorted */
  sortable?: boolean;
  /** Content alignment */
  align?: "left" | "center" | "right";
  /** Additional CSS class for table headers and cells */
  className?: string;
  /** Specific CSS class for table header */
  headerClassName?: string;
  /** Specific CSS class for table cells */
  cellClassName?: string;
  /** Desktop table cell render function */
  render?: (value: any, row: T, index: number) => React.ReactNode;

  // ── AdaptTable Mobile Card Properties ──────────────────────────────
  /** Categorizes role in the responsive mobile card layout (default: "field") */
  mobileRole?: MobileRole;
  /** Label override when displayed in the mobile card key-value matrix */
  mobileLabel?: string;
  /** Hide this column when rendered in mobile card mode */
  hideOnMobile?: boolean;
  /** Custom render function specifically for the mobile card presentation */
  mobileRender?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface FacetDataTableProps<T extends Record<string, any>> {
  /** Array of row data records */
  data: T[];
  /** Column definitions */
  columns: FacetColumn<T>[];
  /** Optional table title */
  title?: string | React.ReactNode;
  /** Optional table description */
  description?: string | React.ReactNode;
  /** Enable search input toolbar */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Keys to match against during in-memory filtering */
  searchKeys?: (keyof T | string)[];
  /** Controlled search term (for server-side querying) */
  searchValue?: string;
  /** Search term change callback */
  onSearchChange?: (term: string) => void;

  /** Enable pagination */
  paginated?: boolean;
  /** Number of items per page (default: 10) */
  pageSize?: number;
  /** Controlled active page number (1-indexed) */
  page?: number;
  /** Total count of items (for server-side pagination) */
  totalCount?: number;
  /** Page change callback */
  onPageChange?: (page: number) => void;
  /** Page size change callback */
  onPageSizeChange?: (pageSize: number) => void;
  /** Page size options for selector (e.g. [10, 25, 50]) */
  pageSizeOptions?: number[];

  /** Controlled sort state */
  sortState?: SortState;
  /** Sort change callback */
  onSortChange?: (sort: SortState) => void;

  /** Layout mode: 'auto' (table on sm+, cards on <sm), 'table' (force table), 'cards' (force cards) */
  layoutMode?: "auto" | "table" | "cards";

  /** Loading state indicator */
  loading?: boolean;
  /** Message displayed when no records exist */
  emptyMessage?: string | React.ReactNode;
  /** Custom icon displayed when empty */
  emptyIcon?: React.ReactNode;

  /** Row / Card click handler */
  onRowClick?: (row: T) => void;
  /** Dynamic CSS class for table rows */
  rowClassName?: (row: T, index: number) => string;
  /** Dynamic CSS class for mobile cards */
  cardClassName?: (row: T, index: number) => string;

  /** Optional toolbar action components */
  toolbarActions?: React.ReactNode;
  /** Enable client-side CSV export */
  exportable?: boolean;
  /** Filename for CSV export (default: 'table-export.csv') */
  exportFilename?: string;

  /** Optional URL synchronization of search, page, and sort state */
  urlSync?: boolean;
  /** Prefix for URL query parameters when urlSync is true (e.g. 'vault_' -> ?vault_page=2) */
  urlPrefix?: string;

  /** Top-level wrapper className */
  className?: string;
  /** Table container specific className */
  tableContainerClassName?: string;
  /** Mobile cards container specific className */
  cardContainerClassName?: string;
}
