/**
 * A model of the part of PostgreSQL that `ArticleRepository.saveArticle` depends on, for tests that run saves at the
 * same time: transactions that buffer their writes until they commit (a transaction that throws leaves nothing, and
 * one that waits for a lock reads what the one before it committed), row locks (`SELECT ... FOR NO KEY UPDATE` on
 * `wiki_articles` by source and title) and transaction-scoped advisory locks (`pg_advisory_xact_lock(ns, hashtext(key))`),
 * both released when the transaction ends. Every operation yields to the event loop first, so concurrent
 * transactions interleave at each statement, as connections do.
 *
 * It understands exactly the statements `saveArticle` makes and throws on any other, so a change to that code that
 * adds one must teach this model about it. `locks: false` turns the locks into no-ops: the model of a save without
 * them, which the tests use to show that the concurrent scenarios do catch a missing lock.
 */

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

interface Store {
  articles: Row[];
  revisions: Row[];
  jobs: Row[];
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function pick(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(select).flatMap(([key, on]) => (on ? [[key, row[key]]] : []))) as Row;
}

export function createLockingWikiDb({ locks = true }: { locks?: boolean } = {}) {
  const committed: Store = { articles: [], revisions: [], jobs: [] };
  const queues = new Map<string, Promise<void>>();
  let counter = 0;
  const newId = (prefix: string) => `${prefix}${++counter}`;

  async function acquire(key: string, releases: Array<() => void>): Promise<void> {
    if (!locks) return;
    const before = queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => (release = resolve));
    queues.set(
      key,
      before.then(() => mine)
    );
    releases.push(release);
    await before;
  }

  function createTx(own: Store, releases: Array<() => void>) {
    /** Committed rows, with this transaction's own writes over them. */
    const articles = () => [...committed.articles.filter((a) => !own.articles.some((o) => o.id === a.id)), ...own.articles];
    const revisions = () => [...committed.revisions, ...own.revisions];
    const articleOf = (source: unknown, title: unknown) =>
      articles().find((a) => a.source === source && a.title === title);

    return {
      async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        await tick();
        if (!/FROM wiki_articles WHERE "source" = \? AND "title" = \? FOR NO KEY UPDATE/.test(strings.join("?").replace(/\s+/g, " "))) {
          throw new Error("the locking model does not understand this query");
        }
        const [source, title] = values;
        const row = articleOf(source, title);
        if (row) await acquire(`row:${row.id}`, releases);
        // after waiting, the row as the transaction that held it left it
        const now = row ? articleOf(source, title) : undefined;
        return now ? [{ id: now.id }] : [];
      },
      async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        await tick();
        // `SELECT set_config('lock_timeout', '10s', true)`: the model's locks wait as long as it takes
        if (strings.join("?").includes("set_config('lock_timeout'")) return 0;
        if (!strings.join("?").includes("pg_advisory_xact_lock") || values.length !== 2) {
          throw new Error("the locking model understands only a two-int advisory lock");
        }
        await acquire(`advisory:${values.join(":")}`, releases);
        return 0;
      },
      user: { findFirst: async () => null },
      wikiArticle: {
        async count({ where }: { where: Where }) {
          await tick();
          return articles().filter((a) => Object.entries(where).every(([k, v]) => a[k] === v)).length;
        },
        async findUnique({ where, select }: { where: { source_title: { source: string; title: string } }; select?: Record<string, boolean> }) {
          await tick();
          const row = articleOf(where.source_title.source, where.source_title.title);
          return row ? pick(row, select) : null;
        },
        async upsert({ where, create, update, select }: { where: { source_title: { source: string; title: string } }; create: Where; update: Where; select?: Record<string, boolean> }) {
          await tick();
          const existing = articleOf(where.source_title.source, where.source_title.title);
          if (!existing && committed.articles.some((a) => a.source === create.source && a.title === create.title)) {
            throw new Error("unique violation: the page was created by another transaction");
          }
          const row: Row = existing
            ? { ...existing, ...update }
            : { id: newId("art-"), status: "PUBLISHED", protectionLevel: "ALL", protectionExpiry: null, ...create };
          own.articles = [...own.articles.filter((a) => a.id !== row.id), row];
          return pick(row, select);
        },
      },
      wikiRevision: {
        async findFirst({ where, orderBy }: { where: { article: { source: string; title: string }; parked: boolean }; orderBy: Array<Record<string, "asc" | "desc">> }) {
          await tick();
          const page = articleOf(where.article.source, where.article.title);
          if (!page) return null;
          const live = revisions().filter((r) => r.articleId === page.id && r.parked === where.parked);
          if (JSON.stringify(orderBy) !== JSON.stringify([{ createdAt: "desc" }, { id: "desc" }])) {
            throw new Error("the locking model reads the head newest first, by (createdAt, id)");
          }
          live.sort(
            (a, b) =>
              (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime() || (a.id < b.id ? 1 : -1)
          );
          return live[0] ? { ...live[0] } : null;
        },
        async create({ data }: { data: Where }) {
          await tick();
          const row: Row = { id: newId("rev-"), mwRevId: null, parked: false, createdAt: new Date(Date.UTC(2030, 0, 1) + counter * 1000), ...data };
          own.revisions.push(row);
          return { ...row };
        },
      },
      wikiMirrorJob: {
        async create({ data }: { data: Where }) {
          await tick();
          own.jobs.push({ id: newId("job-"), ...data });
          return {};
        },
      },
    };
  }

  type Tx = ReturnType<typeof createTx>;

  async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const releases: Array<() => void> = [];
    const own: Store = { articles: [], revisions: [], jobs: [] };
    try {
      const result = await work(createTx(own, releases));
      // commit: the writes become what the next transaction reads
      for (const row of own.articles) {
        committed.articles = [...committed.articles.filter((a) => a.id !== row.id), row];
      }
      committed.revisions.push(...own.revisions);
      committed.jobs.push(...own.jobs);
      return result;
    } finally {
      for (const release of releases) release();
    }
  }

  return { db: { $transaction: transaction }, committed };
}
