/**
 * ThinkPages Forum paging, shared by the server reads and the pages so both agree on page size.
 */
export const THREADS_PER_PAGE = 25;
export const POSTS_PER_PAGE = 20;
/** Highest page the router accepts. */
export const MAX_PAGE = 1000;

/** Reads `?page=` from a route's search params: a whole number from 1 to MAX_PAGE, else 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGE ? n : 1;
}

/** Number of pages for `total` rows, at least 1. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
