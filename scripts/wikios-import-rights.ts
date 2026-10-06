#!/usr/bin/env bun

/**
 * scripts/wikios-import-rights.ts — one-time, operator-run import of MediaWiki rights into WikiOS (plan 409).
 *
 * Reads, through the wiki's public Action API (read-only, one request per second at most, User-Agent
 * `IxStats-Builder`):
 *   - group memberships   list=allusers&augroup=sysop|bureaucrat|interface-admin|bot
 *   - page protections    list=allpages&apprtype=edit|move|upload (per namespace) + prop=info&inprop=protection
 *   - create-protections  list=protectedtitles
 *   - user blocks         list=blocks
 * and maps them onto `wiki_user_groups`, `wiki_restrictions` and `wiki_blocks` (rows with source
 * `mw-import`, keyed by wiki username; a username whose VERIFIED WikiAccountLink the account proved itself
 * gets that user's id; a link an admin confirmed gets nothing, it must not inherit MediaWiki rights).
 *
 * Usage:
 *   bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php            # dry run (default)
 *   bun scripts/wikios-import-rights.ts --api https://ixwiki.com/api.php --yes      # write
 *
 * Before `--yes`: a link an administrator confirmed before `wiki_account_links.verifiedById` existed reads as
 * self-proven (NULL) and would inherit the rights of its wiki account. Set `verifiedById` on those first:
 * docs/operations/wikios-v1-cutover.md, step 1b.
 *
 * A dry run only calls the wiki and prints the plan: it never connects to a database. `--yes` prints the
 * database host first, then upserts: a row that already exists is left exactly as it is, so a re-run adds
 * what is missing and never overwrites a decision made in WikiOS. Anything that cannot be mapped exactly
 * is listed under "Notes" (an unknown protection level becomes `sysop`: fail closed).
 */

import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { canonicalizeTitle } from "../src/lib/wiki-os/core/title";
import { normalizeWikiUsername } from "../src/lib/wiki-os/adapters/mediawiki/account-proof";

export const USER_AGENT = "IxStats-Builder";
/** The wiki is never asked more often than this. */
export const MIN_INTERVAL_MS = 1000;
/** MediaWiki groups carried over (the ones WikiOS has a counterpart for and an administrator hands out). */
export const IMPORTED_GROUPS = ["sysop", "bureaucrat", "interface-admin", "bot"] as const;
export type ImportedGroup = (typeof IMPORTED_GROUPS)[number];
export const PROTECTION_TYPES = ["edit", "move", "upload"] as const;
type ProtectionType = (typeof PROTECTION_TYPES)[number];
export type ImportedLevel = "autoconfirmed" | "sysop";

const TITLES_PER_INFO_REQUEST = 50;
/** A safety stop: no listing on this wiki needs this many continuation pages. */
const MAX_CONTINUATIONS = 500;
const IMPORT_REASON = "Imported from MediaWiki";

export interface GroupGrant {
  wikiUsername: string;
  group: ImportedGroup;
}

export interface RestrictionImport {
  /** Canonical title. */
  title: string;
  action: ProtectionType | "create";
  level: ImportedLevel;
  expiresAt: Date | null;
  reason: string;
}

export interface BlockImport {
  wikiUsername: string;
  reason: string | null;
  expiresAt: Date | null;
  allowUserTalk: boolean;
}

export interface ImportPlan {
  groups: GroupGrant[];
  restrictions: RestrictionImport[];
  blocks: BlockImport[];
  /** What was skipped or tightened, for the operator to read. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// The Action API, read-only and throttled
// ---------------------------------------------------------------------------

export type ApiGet = (params: Record<string, string>) => Promise<unknown>;

export interface ApiClientOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Spacing between requests; never below MIN_INTERVAL_MS. */
  intervalMs?: number;
}

/** A GET client for one api.php: JSON, formatversion 2, the allowlisted UA, one request per interval. */
export function createApiClient(apiUrl: string, options: ApiClientOptions = {}): ApiGet {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const interval = Math.max(MIN_INTERVAL_MS, options.intervalMs ?? MIN_INTERVAL_MS);
  let requests = 0;

  return async (params) => {
    if (requests > 0) await sleep(interval);
    requests += 1;
    const url = new URL(apiUrl);
    for (const [key, value] of Object.entries({
      action: "query",
      format: "json",
      formatversion: "2",
      ...params,
    })) {
      url.searchParams.set(key, value);
    }
    const response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`api.php answered ${response.status}`);
    return (await response.json()) as unknown;
  };
}

const ContinueSchema = z.record(z.string(), z.string()).optional();
const ApiErrorSchema = z.object({ error: z.object({ code: z.string(), info: z.string() }) });

/** Parse one response with `schema`, turning an API `error` object into a thrown Error. */
function parseResponse<T>(schema: z.ZodType<T>, json: unknown): T {
  const failure = ApiErrorSchema.safeParse(json);
  if (failure.success)
    throw new Error(`api.php: ${failure.data.error.code}: ${failure.data.error.info}`);
  return schema.parse(json);
}

/** Every item of a continued listing: `parse` pulls the items and the `continue` parameters out of a response. */
export async function collectAll<T>(
  get: ApiGet,
  params: Record<string, string>,
  parse: (json: unknown) => { items: T[]; next: Record<string, string> | undefined }
): Promise<T[]> {
  const items: T[] = [];
  let next: Record<string, string> | undefined;
  for (let page = 0; page < MAX_CONTINUATIONS; page += 1) {
    const result = parse(await get({ ...params, ...next }));
    items.push(...result.items);
    if (!result.next) return items;
    next = result.next;
  }
  throw new Error(
    `api.php: ${JSON.stringify(params)} did not finish after ${MAX_CONTINUATIONS} pages`
  );
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const AllUsersSchema = z.object({
  continue: ContinueSchema,
  query: z
    .object({
      allusers: z.array(z.object({ name: z.string(), groups: z.array(z.string()).default([]) })),
    })
    .optional(),
});
export type MwUser = { name: string; groups: string[] };

export function parseAllUsers(json: unknown) {
  const data = parseResponse(AllUsersSchema, json);
  return { items: data.query?.allusers ?? [], next: data.continue };
}

const AllPagesSchema = z.object({
  continue: ContinueSchema,
  query: z.object({ allpages: z.array(z.object({ title: z.string() })) }).optional(),
});

export function parseAllPages(json: unknown) {
  const data = parseResponse(AllPagesSchema, json);
  return { items: (data.query?.allpages ?? []).map((page) => page.title), next: data.continue };
}

const ProtectionEntrySchema = z.object({
  type: z.string(),
  level: z.string(),
  expiry: z.string().optional(),
  cascade: z.boolean().optional(),
  /** Set when the page is protected by cascade from another page: not its own protection. */
  source: z.string().optional(),
});
export type MwProtection = z.infer<typeof ProtectionEntrySchema>;

const InfoSchema = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({ title: z.string(), protection: z.array(ProtectionEntrySchema).default([]) })
      ),
    })
    .optional(),
});
export type MwProtectedPage = { title: string; protection: MwProtection[] };

export function parseInfo(json: unknown): MwProtectedPage[] {
  return parseResponse(InfoSchema, json).query?.pages ?? [];
}

const ProtectedTitlesSchema = z.object({
  continue: ContinueSchema,
  query: z
    .object({
      protectedtitles: z.array(
        z.object({
          title: z.string(),
          level: z.string(),
          expiry: z.string().optional(),
          comment: z.string().optional(),
        })
      ),
    })
    .optional(),
});
export type MwProtectedTitle = { title: string; level: string; expiry?: string; comment?: string };

export function parseProtectedTitles(json: unknown) {
  const data = parseResponse(ProtectedTitlesSchema, json);
  return { items: data.query?.protectedtitles ?? [], next: data.continue };
}

const BlocksSchema = z.object({
  continue: ContinueSchema,
  query: z
    .object({
      blocks: z.array(
        z.object({
          user: z.string().optional(),
          userid: z.number().optional(),
          expiry: z.string().optional(),
          reason: z.string().optional(),
          partial: z.boolean().optional(),
          allowusertalk: z.boolean().optional(),
        })
      ),
    })
    .optional(),
});
export type MwBlock = {
  user?: string;
  userid?: number;
  expiry?: string;
  reason?: string;
  partial?: boolean;
  allowusertalk?: boolean;
};

export function parseBlocks(json: unknown) {
  const data = parseResponse(BlocksSchema, json);
  return { items: data.query?.blocks ?? [], next: data.continue };
}

const NamespacesSchema = z.object({
  query: z.object({ namespaces: z.record(z.string(), z.object({ id: z.number() })) }),
});

/** The ids of the wiki's real namespaces (Special and Media, which hold no pages, are left out). */
export function parseNamespaceIds(json: unknown): number[] {
  const namespaces = parseResponse(NamespacesSchema, json).query.namespaces;
  return Object.values(namespaces)
    .map((namespace) => namespace.id)
    .filter((id) => id >= 0)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Mapping (pure)
// ---------------------------------------------------------------------------

/** A MediaWiki expiry: "infinity" (or "infinite", "indefinite", "never", none) is no expiry. */
export function parseExpiry(expiry: string | undefined): Date | null {
  if (expiry === undefined || /^(infinity|infinite|indefinite|never)$/i.test(expiry)) return null;
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) throw new Error(`Unreadable expiry ${JSON.stringify(expiry)}`);
  return date;
}

const isExpired = (expiresAt: Date | null, now: Date): boolean =>
  expiresAt !== null && expiresAt <= now;

const isImportedGroup = (group: string): group is ImportedGroup =>
  (IMPORTED_GROUPS as readonly string[]).includes(group);

/** One grant per (user, group) for the groups WikiOS imports; a user in two groups gets two. */
export function mapGroups(users: readonly MwUser[]): GroupGrant[] {
  const seen = new Set<string>();
  const grants: GroupGrant[] = [];
  for (const user of users) {
    const wikiUsername = normalizeWikiUsername(user.name);
    for (const group of user.groups.filter(isImportedGroup)) {
      const key = `${wikiUsername}\n${group}`;
      if (seen.has(key)) continue;
      seen.add(key);
      grants.push({ wikiUsername, group });
    }
  }
  return grants;
}

/** `autoconfirmed` and `sysop` map to themselves; any other level is tightened to `sysop` (and noted). */
function mapLevel(level: string, where: string, notes: string[]): ImportedLevel {
  if (level === "autoconfirmed" || level === "sysop") return level;
  notes.push(`${where}: MediaWiki level "${level}" has no WikiOS counterpart; imported as sysop.`);
  return "sysop";
}

function isProtectionType(type: string): type is ProtectionType {
  return (PROTECTION_TYPES as readonly string[]).includes(type);
}

/** Canonical title, or null (noted) for one MediaWiki's title rules would refuse. */
function canonical(title: string, notes: string[]): string | null {
  const canon = canonicalizeTitle(title);
  if (!canon) notes.push(`Skipped "${title}": not a valid page title.`);
  return canon?.title ?? null;
}

/** The page's own edit/move/upload protections still in force (inherited cascade protection is not its own). */
export function mapProtections(
  pages: readonly MwProtectedPage[],
  now: Date,
  notes: string[]
): RestrictionImport[] {
  const restrictions: RestrictionImport[] = [];
  for (const page of pages) {
    const title = canonical(page.title, notes);
    if (!title) continue;
    for (const entry of page.protection) {
      if (entry.source !== undefined || !isProtectionType(entry.type)) continue;
      const expiresAt = parseExpiry(entry.expiry);
      if (isExpired(expiresAt, now)) continue;
      if (entry.cascade === true) {
        notes.push(
          `${title} (${entry.type}): cascade protection is not supported yet; imported as plain protection.`
        );
      }
      restrictions.push({
        title,
        action: entry.type,
        level: mapLevel(entry.level, `${title} (${entry.type})`, notes),
        expiresAt,
        reason: IMPORT_REASON,
      });
    }
  }
  return restrictions;
}

/** Create-protection on titles that have no page. */
export function mapProtectedTitles(
  titles: readonly MwProtectedTitle[],
  now: Date,
  notes: string[]
): RestrictionImport[] {
  const restrictions: RestrictionImport[] = [];
  for (const entry of titles) {
    const title = canonical(entry.title, notes);
    const expiresAt = parseExpiry(entry.expiry);
    if (!title || isExpired(expiresAt, now)) continue;
    restrictions.push({
      title,
      action: "create",
      level: mapLevel(entry.level, `${title} (create)`, notes),
      expiresAt,
      reason: entry.comment ? `${IMPORT_REASON}: ${entry.comment}`.slice(0, 500) : IMPORT_REASON,
    });
  }
  return restrictions;
}

/** Blocks on registered users in force now. IP blocks and partial (page or namespace) blocks are skipped and noted. */
export function mapBlocks(blocks: readonly MwBlock[], now: Date, notes: string[]): BlockImport[] {
  const imported: BlockImport[] = [];
  let ipBlocks = 0;
  let partialBlocks = 0;
  for (const block of blocks) {
    if (!block.user || !block.userid) {
      ipBlocks += 1;
      continue;
    }
    if (block.partial) {
      partialBlocks += 1;
      continue;
    }
    const expiresAt = parseExpiry(block.expiry);
    if (isExpired(expiresAt, now)) continue;
    imported.push({
      wikiUsername: normalizeWikiUsername(block.user),
      reason: block.reason ? block.reason.slice(0, 500) : null,
      expiresAt,
      allowUserTalk: block.allowusertalk ?? true,
    });
  }
  if (ipBlocks > 0) notes.push(`Skipped ${ipBlocks} block(s) on IP addresses or ranges.`);
  if (partialBlocks > 0)
    notes.push(`Skipped ${partialBlocks} partial (page or namespace) block(s).`);
  return imported;
}

// ---------------------------------------------------------------------------
// Reading the wiki
// ---------------------------------------------------------------------------

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

async function readProtectedPages(get: ApiGet): Promise<MwProtectedPage[]> {
  const namespaces = parseNamespaceIds(await get({ meta: "siteinfo", siprop: "namespaces" }));
  const titles: string[] = [];
  for (const namespace of namespaces) {
    titles.push(
      ...(await collectAll(
        get,
        {
          list: "allpages",
          apnamespace: String(namespace),
          apprtype: PROTECTION_TYPES.join("|"),
          apprlevel: "autoconfirmed|sysop",
          aplimit: "max",
        },
        parseAllPages
      ))
    );
  }
  const pages: MwProtectedPage[] = [];
  for (const batch of chunks(titles, TITLES_PER_INFO_REQUEST)) {
    pages.push(
      ...parseInfo(await get({ prop: "info", inprop: "protection", titles: batch.join("|") }))
    );
  }
  return pages;
}

/** Everything the import would write, read from the wiki. */
export async function buildPlan(get: ApiGet, now: Date): Promise<ImportPlan> {
  const notes: string[] = [];
  const users: MwUser[] = [];
  for (const group of IMPORTED_GROUPS) {
    users.push(
      ...(await collectAll(
        get,
        { list: "allusers", augroup: group, auprop: "groups", aulimit: "max" },
        parseAllUsers
      ))
    );
  }
  const protectedPages = await readProtectedPages(get);
  const protectedTitles = await collectAll(
    get,
    { list: "protectedtitles", ptprop: "level|expiry|comment", ptlimit: "max" },
    parseProtectedTitles
  );
  const blocks = await collectAll(
    get,
    { list: "blocks", bkprop: "user|userid|expiry|reason|flags", bklimit: "max" },
    parseBlocks
  );

  return {
    groups: mapGroups(users),
    restrictions: [
      ...mapProtections(protectedPages, now, notes),
      ...mapProtectedTitles(protectedTitles, now, notes),
    ],
    blocks: mapBlocks(blocks, now, notes),
    notes,
  };
}

// ---------------------------------------------------------------------------
// Writing (only with --yes)
// ---------------------------------------------------------------------------

/** What `WikiArticle.protectionLevel` shows for an `edit` restriction. */
const LEGACY_LEVEL: Record<ImportedLevel, string> = {
  autoconfirmed: "AUTOCONFIRMED",
  sysop: "SYSOP",
};

export interface ApplyResult {
  groups: number;
  restrictions: number;
  blocks: number;
}

/**
 * Upsert the plan. A row that exists is left as it is (`update: {}`), so this is safe to re-run and never
 * overwrites a change made in WikiOS. A wiki username with a verified link is stored against that user.
 */
export async function applyPlan(prisma: PrismaClient, plan: ImportPlan): Promise<ApplyResult> {
  const names = [...new Set([...plan.groups, ...plan.blocks].map((row) => row.wikiUsername))];
  // Only links the account proved itself (no admin confirmed them): an admin-confirmed link must not
  // inherit a name's groups, so those names stay keyed by wiki username, which such a link never matches.
  const links = await prisma.wikiAccountLink.findMany({
    where: {
      source: "ixwiki",
      verifiedAt: { not: null },
      verifiedById: null,
      username: { in: names },
    },
    select: { userId: true, username: true },
  });
  const userIdOf = new Map(links.map((link) => [link.username, link.userId]));

  for (const { wikiUsername, group } of plan.groups) {
    const userId = userIdOf.get(wikiUsername);
    if (userId) {
      await prisma.wikiUserGroup.upsert({
        where: { userId_group: { userId, group } },
        create: { userId, group, source: "mw-import" },
        update: {},
      });
    } else {
      await prisma.wikiUserGroup.upsert({
        where: { wikiUsername_group: { wikiUsername, group } },
        create: { wikiUsername, group, source: "mw-import" },
        update: {},
      });
    }
  }

  for (const restriction of plan.restrictions) {
    const { title, action, level, expiresAt, reason } = restriction;
    await prisma.wikiRestriction.upsert({
      where: { source_title_action: { source: "ixwiki", title, action } },
      create: { source: "ixwiki", title, action, level, expiresAt, reason },
      update: {},
    });
    if (action === "edit") {
      await prisma.wikiArticle.updateMany({
        where: { source: "ixwiki", title },
        data: { protectionLevel: LEGACY_LEVEL[level], protectionExpiry: expiresAt },
      });
    }
  }

  for (const block of plan.blocks) {
    const userId = userIdOf.get(block.wikiUsername) ?? null;
    const existing = await prisma.wikiBlock.findFirst({
      where: { source: "mw-import", wikiUsername: block.wikiUsername },
      select: { id: true },
    });
    if (!existing)
      await prisma.wikiBlock.create({ data: { ...block, userId, source: "mw-import" } });
  }

  return {
    groups: plan.groups.length,
    restrictions: plan.restrictions.length,
    blocks: plan.blocks.length,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliArgs {
  api: string;
  yes: boolean;
}

/** `--api <url>` (required, an http(s) URL), `--yes` to write; `--dry-run` is the default and may be spelled out. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const apiIndex = argv.indexOf("--api");
  const api = apiIndex >= 0 ? argv[apiIndex + 1] : undefined;
  if (!api || !/^https?:\/\//.test(api)) {
    throw new Error("Give the wiki's api.php with --api https://…/api.php");
  }
  const yes = argv.includes("--yes");
  if (yes && argv.includes("--dry-run"))
    throw new Error("--yes and --dry-run contradict each other.");
  return { api, yes };
}

/** `host:port` of DATABASE_URL (never the credentials), or null when it is missing or unreadable. */
export function databaseHost(databaseUrl: string | undefined): string | null {
  try {
    const url = new URL(databaseUrl ?? "");
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return null;
  }
}

function printPlan(plan: ImportPlan): void {
  const sample = <T>(title: string, rows: readonly T[], show: (row: T) => string) => {
    console.log(`\n${title}: ${rows.length}`);
    for (const row of rows.slice(0, 10)) console.log(`  ${show(row)}`);
    if (rows.length > 10) console.log(`  … and ${rows.length - 10} more`);
  };
  sample("Group memberships", plan.groups, (g) => `${g.wikiUsername} -> ${g.group}`);
  sample(
    "Restrictions",
    plan.restrictions,
    (r) =>
      `${r.title}: ${r.action} ${r.level}${r.expiresAt ? ` until ${r.expiresAt.toISOString()}` : ""}`
  );
  sample(
    "Blocks",
    plan.blocks,
    (b) =>
      `${b.wikiUsername}${b.expiresAt ? ` until ${b.expiresAt.toISOString()}` : " (indefinite)"}: ${b.reason ?? ""}`
  );
  sample("Notes", plan.notes, (note) => note);
}

async function runCLI(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Reading ${args.api} (read-only, one request per second)…`);
  const plan = await buildPlan(createApiClient(args.api), new Date());
  printPlan(plan);

  if (!args.yes) {
    console.log("\nDry run: nothing was written. Re-run with --yes to write.");
    return;
  }
  const host = databaseHost(process.env.DATABASE_URL);
  if (!host) throw new Error("DATABASE_URL is not set or unreadable.");
  console.log(`\nWriting to the database at ${host}…`);
  const prisma = new PrismaClient();
  try {
    const result = await applyPlan(prisma, plan);
    console.log(
      `Done: ${result.groups} group rows, ${result.restrictions} restrictions, ${result.blocks} blocks.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.main) {
  runCLI().catch((error: Error) => {
    console.error(`[wikios-import-rights] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
