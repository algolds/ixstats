// Safe defaults for database queries to prevent unbounded result sets

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;

export interface PaginationInput {
  take?: number;
  skip?: number;
}

export function paginate(input: PaginationInput = {}, max = MAX_PAGE_SIZE) {
  return {
    take: Math.min(input.take ?? DEFAULT_PAGE_SIZE, max),
    skip: input.skip ?? 0,
  };
}
