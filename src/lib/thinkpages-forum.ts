/**
 * ThinkPages Forum paging, shared by the server reads and the pages so both agree on page size.
 */
export const THREADS_PER_PAGE = 25;
export const POSTS_PER_PAGE = 20;

/** Reads `?page=` from a route's search params: a whole number from 1 to 1000 (the router's cap), else 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

/** Number of pages for `total` rows, at least 1. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
