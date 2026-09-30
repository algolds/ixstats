/**
 * revision-plan.ts — decide, for one page, what a dump's revisions mean for the revisions WikiOS
 * already holds. Pure: no database, so the rules are testable on their own and a dry run and a
 * real import cannot disagree.
 *
 * Per dump revision, in timestamp order:
 *   - a row with that MediaWiki rev id exists on this page: skip it, unless that row is an empty
 *     placeholder (`scripts/sync-ixwiki-full.ts` stores history that way) and the dump carries the
 *     text: then fill it;
 *   - that rev id belongs to another page: a conflict, skipped;
 *   - no row has the id, but a row of this page has the same sha1 and the same second of
 *     timestamp (a WikiOS edit whose MediaWiki twin arrives in a dump): stamp the rev id on it;
 *   - otherwise: insert.
 */

export interface ImportedRevision {
  /** MediaWiki rev id; null when the dump has none. */
  mwRevId: number | null;
  createdAt: Date;
  /** Username, IP address or "(deleted)". */
  author: string;
  /** The WikiOS user, only through a verified WikiAccountLink. */
  authorId: string | null;
  summary: string | null;
  minor: boolean;
  byteSize: number;
  /** Size against the previous revision of the dump (the first revision: its own size). */
  byteDelta: number;
  sha1: string | null;
  /** null when the dump does not carry the text: stored as "", a placeholder a later dump fills. */
  wikitext: string | null;
}

/** The columns of a stored revision the plan needs. */
export interface ExistingRevisionRow {
  id: string;
  articleId: string;
  mwRevId: number | null;
  sha1: string | null;
  createdAt: Date;
  /** The row's wikitext is "" (an unfilled placeholder, or a genuinely blank revision). */
  isPlaceholder: boolean;
}

export interface RevisionPlan {
  inserts: ImportedRevision[];
  fills: Array<{ rowId: string; revision: ImportedRevision }>;
  stamps: Array<{ rowId: string; mwRevId: number }>;
  /** Already present (stamped twins included): nothing to do. */
  skipped: number;
  /** Rev ids that already belong to a different page. */
  conflicts: number;
}

const secondOf = (date: Date): number => Math.floor(date.getTime() / 1000);
const twinKey = (sha1: string, date: Date): string => `${sha1}|${secondOf(date)}`;

/** Whether a dump revision carries text that could replace a placeholder. */
const hasText = (revision: ImportedRevision): boolean =>
  revision.wikitext !== null && revision.wikitext !== "";

/** This page's rows with a hash, by hash and second, for twin matching. */
function indexTwins(rows: ExistingRevisionRow[]): Map<string, ExistingRevisionRow[]> {
  const twins = new Map<string, ExistingRevisionRow[]>();
  for (const row of rows) {
    if (row.sha1 === null) continue;
    const key = twinKey(row.sha1, row.createdAt);
    twins.set(key, [...(twins.get(key) ?? []), row]);
  }
  return twins;
}

/**
 * The unclaimed row of this page that is `revision` seen through another system: same hash, same
 * second, and not a different MediaWiki revision (two rows with different rev ids are never twins).
 */
function takeTwin(
  twins: Map<string, ExistingRevisionRow[]>,
  revision: ImportedRevision
): ExistingRevisionRow | undefined {
  if (revision.sha1 === null) return undefined;
  const candidates = twins.get(twinKey(revision.sha1, revision.createdAt)) ?? [];
  const index = candidates.findIndex((row) => row.mwRevId === null || revision.mwRevId === null);
  const [twin] = index === -1 ? [] : candidates.splice(index, 1);
  return twin;
}

/** A dump revision whose rev id is already stored: conflict, fill a placeholder, or skip. */
function planKnown(
  plan: RevisionPlan,
  known: ExistingRevisionRow,
  articleId: string | null,
  revision: ImportedRevision
): void {
  if (known.articleId !== articleId) plan.conflicts += 1;
  else if (known.isPlaceholder && hasText(revision)) plan.fills.push({ rowId: known.id, revision });
  else plan.skipped += 1;
}

/** A dump revision that is a stored WikiOS revision's twin: it only gives that row its rev id. */
function planTwin(plan: RevisionPlan, twin: ExistingRevisionRow, revision: ImportedRevision): void {
  if (revision.mwRevId !== null && twin.mwRevId === null) {
    plan.stamps.push({ rowId: twin.id, mwRevId: revision.mwRevId });
  }
  plan.skipped += 1;
}

/**
 * Plan the import of `revisions` (oldest first) into the page `articleId` (null: the page does not
 * exist yet). `existing` holds every stored row of that page plus any row, on any page, that
 * carries one of the dump's rev ids.
 */
export function planRevisionImport(
  articleId: string | null,
  existing: ExistingRevisionRow[],
  revisions: ImportedRevision[]
): RevisionPlan {
  const byMwRevId = new Map<number, ExistingRevisionRow>();
  for (const row of existing) {
    if (row.mwRevId !== null) byMwRevId.set(row.mwRevId, row);
  }
  const twins = indexTwins(existing.filter((row) => row.articleId === articleId));
  const seenInDump = new Set<number>();
  const plan: RevisionPlan = { inserts: [], fills: [], stamps: [], skipped: 0, conflicts: 0 };

  for (const revision of revisions) {
    const known = revision.mwRevId === null ? undefined : byMwRevId.get(revision.mwRevId);
    if (known) {
      planKnown(plan, known, articleId, revision);
      continue;
    }
    if (revision.mwRevId !== null) {
      // The same rev id twice in one dump: the second one is a repeat, not a new revision.
      if (seenInDump.has(revision.mwRevId)) {
        plan.skipped += 1;
        continue;
      }
      seenInDump.add(revision.mwRevId);
    }

    const twin = takeTwin(twins, revision);
    if (twin) planTwin(plan, twin, revision);
    else plan.inserts.push(revision);
  }
  return plan;
}
