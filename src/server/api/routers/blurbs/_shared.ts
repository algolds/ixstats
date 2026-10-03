import { z } from "zod/v4";

/** limit/cursor input shared by the paginated blurb queries. */
export const cursorPageInput = {
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
};

/** Prisma `take` / `cursor` / `skip` args for a limit+1 cursor page. */
export const cursorPageArgs = (page: { limit: number; cursor?: string }) => ({
  take: page.limit + 1,
  ...(page.cursor && { cursor: { id: page.cursor }, skip: 1 }),
});

/** Drop the look-ahead row fetched by cursorPageArgs and return its id as the next cursor. */
export function trimCursorPage<T extends { id: string }>(rows: T[], limit: number) {
  const nextCursor = rows.length > limit ? rows.pop()!.id : undefined;
  return { rows, nextCursor };
}

export const PROMPT_SUMMARY = {
  select: { id: true, title: true, question: true, slug: true },
} as const;
export const COUNTRY_BADGE = { select: { id: true, name: true, flag: true } } as const;
