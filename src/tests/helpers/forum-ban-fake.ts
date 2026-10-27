/**
 * ForumBan rows and a `forumBan.findMany` fake that interprets `activeBansFor`'s where clause, so expiry, lifting
 * and place are tested as behaviour wherever forum posting access is exercised.
 */
export interface BanRow {
  id: string;
  userId: string;
  scope: string;
  scopeId: string | null;
  reason: string;
  expiresAt: Date | null;
  auto: boolean;
  liftedAt: Date | null;
}

export const banRow = (extra: Partial<BanRow>): BanRow => ({
  id: "b1",
  userId: "u_m",
  scope: "site",
  scopeId: null,
  reason: "Spam",
  expiresAt: null,
  auto: false,
  liftedAt: null,
  ...extra,
});

interface PlaceWhere {
  scope: string;
  scopeId?: string;
}
export interface ActiveBanWhere {
  userId: string;
  liftedAt: null;
  AND: [{ OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }> }, { OR: PlaceWhere[] }];
}

export function matchesActiveBan(row: BanRow, where: ActiveBanWhere): boolean {
  const [time, place] = where.AND;
  const live = time.OR.some((t) =>
    t.expiresAt === null
      ? row.expiresAt === null
      : row.expiresAt !== null && row.expiresAt > t.expiresAt.gt
  );
  const here = place.OR.some(
    (p) => p.scope === row.scope && (p.scopeId === undefined || p.scopeId === row.scopeId)
  );
  return row.userId === where.userId && row.liftedAt === null && live && here;
}

/** `forumBan` with a `findMany` answering activeBansFor's query over `rows`, projected to its select. */
export function forumBanFake(rows: readonly BanRow[] = []) {
  return {
    findMany: jest.fn(async ({ where }: { where: ActiveBanWhere }) =>
      rows
        .filter((row) => matchesActiveBan(row, where))
        .map(({ id, scope, scopeId, reason, expiresAt, auto }) => ({
          id,
          scope,
          scopeId,
          reason,
          expiresAt,
          auto,
        }))
    ),
  };
}
