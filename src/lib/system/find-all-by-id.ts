/** One page of an id-ordered findMany: spread it into the query's arguments. */
export interface IdPage {
  take: number;
  orderBy: { id: "asc" };
  cursor?: { id: string };
  skip?: number;
}

/**
 * Reads every matching row in id-ordered pages. An unbounded findMany is capped at 1,000 rows
 * by the db.ts guard, which silently dropped the rest in jobs that walk whole tables.
 *
 *   const relations = await findAllById((page) =>
 *     db.diplomaticRelation.findMany({ where: { status: "active" }, ...page })
 *   );
 */
export async function findAllById<T extends { id: string }>(
  fetchPage: (page: IdPage) => Promise<T[]>,
  pageSize = 500
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await fetchPage({
      take: pageSize,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
    cursor = page[page.length - 1]!.id;
  }
}
