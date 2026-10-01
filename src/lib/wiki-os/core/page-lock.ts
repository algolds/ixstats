/**
 * page-lock.ts — who may write a page at the moment.
 *
 * `lockPageForSave` serializes everything that writes a page's text and revisions (a save, an XML import, the inbound
 * sync's imports); `lockTitleForCreation` serializes the creation of a title (a save that creates the page, a page
 * move to a title that does not exist yet). Both are transaction-scoped: they are released when the caller's
 * transaction ends, and the wait for them is bounded (`lock_timeout`), so a caller behind a long holder fails as busy
 * (page-busy-error.ts) instead of keeping its connection for as long as the holder runs.
 */

import type { Prisma } from "@prisma/client";

type LockClient = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

/**
 * The first int of the per-title creation locks, in the two-int form `pg_advisory_xact_lock(namespace, key)` (a key
 * space of its own: the single-int locks are `withJobLock`'s, staged-uploads.ts uses 41101, cards 7331). Arbitrary.
 */
const ARTICLE_SAVE_LOCK_NAMESPACE = 41102;

/**
 * How long a caller waits for a page's lock before it gives up as busy (PostgreSQL's `lock_timeout`, set for the
 * transaction only). Prisma's transaction timeout alone does not bound the wait: it cannot cancel a statement that is
 * blocked on a lock, so the connection would stay occupied until the holder (a long import of the page) finished.
 */
const LOCK_TIMEOUT = "10s";

/** For this transaction only (`is_local`); the statement that waits too long fails with 55P03, which reads as busy. */
function limitLockWait(tx: LockClient): Promise<number> {
  return tx.$executeRaw`SELECT set_config('lock_timeout', ${LOCK_TIMEOUT}, true)`;
}

/** The advisory lock of the creation of `title`. $executeRaw, not $queryRaw: the function returns `void`, which Prisma cannot read back as a row. */
function takeCreationLock(tx: LockClient, source: string, title: string): Promise<number> {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(${ARTICLE_SAVE_LOCK_NAMESPACE}::int, hashtext(${`${source}:${title}`}))`;
}

/**
 * Wait for the right to create `title`: the creators of one title (a save, a move to it) queue on an advisory lock,
 * and the one that gets it second finds the page the first made. A page that exists needs no such lock (it has a
 * row to lock: `lockPageForSave`), but taking it does no harm.
 */
export async function lockTitleForCreation(tx: LockClient, source: string, title: string): Promise<void> {
  await limitLockWait(tx);
  await takeCreationLock(tx, source, title);
}

/**
 * Serialize the writers of one page: take the article row's lock (`SELECT ... FOR NO KEY UPDATE`, held until the
 * transaction ends), so a second writer of the page waits here until the first has committed and then reads what it
 * left. The lock is the row's own, so a writer that updates the row (a page move, the inbound sync) queues behind a save
 * too. NO KEY UPDATE, not UPDATE: it conflicts with every other writer of the row but not with the FOR KEY SHARE lock
 * that the foreign-key check of an insert referencing the row takes (the render's link, category and image rows), so a
 * render storing its metadata is never blocked behind a save, nor a save behind it. A page with no row yet cannot be
 * locked: its creators queue on the creation lock instead (`lockTitleForCreation`), and the one that gets it second
 * reads the page the first created. Resolves to the locked row's id; null when there was no row.
 */
export async function lockPageForSave(
  tx: LockClient,
  source: string,
  title: string
): Promise<string | null> {
  await limitLockWait(tx);
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM wiki_articles WHERE "source" = ${source} AND "title" = ${title} FOR NO KEY UPDATE`;
  if (locked[0]) return locked[0].id;
  await takeCreationLock(tx, source, title);
  return null;
}
