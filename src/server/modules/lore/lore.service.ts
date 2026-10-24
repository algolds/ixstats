/**
 * Native lore (docs/superpowers/specs/2026-10-24-native-lore-design.md): who may write a country's lore, which pieces
 * its Lore tab lists, and the owner's lore team and curation. Pieces are ordinary wiki pages; this keeps only the team
 * (`CountryLoreAuthor`) and the curation (`CountryLorePage`: a piece's type, pin and hide, and pages the owner added).
 *
 * Native lore is for countries in the default realm, while WikiOS editing is on. The country's owner (anyone
 * `hasCountryWriteAccess` lets write it) manages the team and the curation; the owner and the team record pieces they
 * write. Every write checks this again here. Lore modules do not read identity: the router injects how a handle
 * resolves and how players are named (`LoreIdentity`).
 */
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { refreshWikiosEditingFlag } from "~/lib/wiki-os/editing-switch";
import { loadCategoryMembers } from "~/lib/wiki-os/services/category-members";
import { readVisiblePage } from "~/lib/wiki-os/services/visible-page";
import { db } from "~/server/db";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import { inferLoreType, isLoreType, loreCategory, type LoreType } from "./lore.infer";

/** The caller, as WikiOS reads and the country write check see them (a tRPC context). */
export type LoreCtx = WikiAuthContext & Parameters<typeof hasCountryWriteAccess>[0];

export interface LoreAccess {
  /** Native lore is on for this country: the default realm, while WikiOS editing is on. */
  enabled: boolean;
  /** The caller manages the lore team and the curation. */
  isOwner: boolean;
  /** The caller may write pieces: the owner or a lore team member, while enabled. */
  canWrite: boolean;
}

export interface LorePiece {
  /** The wiki title, after redirects. */
  title: string;
  type: LoreType;
  pinned: boolean;
}

export interface LoreAuthorName {
  handle: string;
  /** Their name by the identity rule; null reads "a player". */
  displayName: string | null;
}

export interface LoreTeamMember extends LoreAuthorName {
  userId: string;
}

export interface LoreIdentity {
  /** The user a passport handle names, or null: `resolveHandleUser`. */
  userOfHandle: (handle: string) => Promise<string | null>;
  /** Players' passport handles and display names, in one batch: `loadPlayerNames`. */
  namesOf: (userIds: readonly string[]) => Promise<ReadonlyMap<string, LoreAuthorName>>;
}

/** The most lore category pages listed. */
const CATEGORY_LIMIT = 500;

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const noSuchPage = () =>
  new TRPCError({ code: "NOT_FOUND", message: "No wiki page has that title." });

const titleKey = (countryId: string, title: string) => ({
  countryId_title: { countryId, title },
});

function loreCountry(countryId: string) {
  return db.country.findUnique({
    where: { id: countryId },
    select: { name: true, realmId: true, ownerUserId: true },
  });
}

async function isLoreAuthor(ctx: LoreCtx, countryId: string): Promise<boolean> {
  const userId = ctx.user?.id;
  if (!userId) return false;
  const row = await db.countryLoreAuthor.findUnique({
    where: { countryId_userId: { countryId, userId } },
    select: { id: true },
  });
  return row !== null;
}

async function resolveAccess(ctx: LoreCtx, countryId: string) {
  const country = await loreCountry(countryId);
  if (country?.realmId !== DEFAULT_REALM_ID || !(await refreshWikiosEditingFlag())) {
    return { access: { enabled: false, isOwner: false, canWrite: false }, ownerUserId: null };
  }
  const isOwner = await hasCountryWriteAccess(ctx, countryId);
  const canWrite = isOwner || (await isLoreAuthor(ctx, countryId));
  return { access: { enabled: true, isOwner, canWrite }, ownerUserId: country.ownerUserId };
}

export async function getLoreAccess(ctx: LoreCtx, countryId: string): Promise<LoreAccess> {
  return (await resolveAccess(ctx, countryId)).access;
}

/**
 * The caller's user id when they may do this ("own": manage the team and curation; "write": record a piece), else
 * FORBIDDEN, also for a country outside the default realm or while editing is off.
 */
async function requireLore(ctx: LoreCtx, countryId: string, need: "own" | "write") {
  const { access, ownerUserId } = await resolveAccess(ctx, countryId);
  if (!access.enabled) throw forbidden("Native lore is not available for this country.");
  const userId = ctx.user?.id;
  if (need === "own" && (!access.isOwner || !userId)) {
    throw forbidden("Only the country's owner can do this.");
  }
  if (!access.canWrite || !userId) throw forbidden("You cannot write this country's lore.");
  return { userId, ownerUserId };
}

function canonicalTitleOf(raw: string): string {
  const title = canonicalizeTitle(raw)?.title;
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "That is not a valid page title." });
  return title;
}

// ── Listing ──────────────────────────────────────────────────────────────────

interface Curation {
  title: string;
  type: string;
  pinned: boolean;
  hidden: boolean;
}

/** A page the candidates lead to, with every curation row that names it (by its own title or a redirect to it). */
interface ListedPage {
  wikitext: string;
  rows: Curation[];
}

const spaced = (title: string) => title.replace(/_/g, " ");

function toPiece(title: string, page: ListedPage, curation: ReadonlyMap<string, Curation>) {
  if (page.rows.some((row) => row.hidden)) return null;
  const row = curation.get(title) ?? page.rows[0];
  const type = row && isLoreType(row.type) ? row.type : inferLoreType(page.wikitext);
  return { title, type, pinned: row?.pinned ?? false };
}

const byPinThenTitle = (a: LorePiece, b: LorePiece) =>
  Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title);

/**
 * The pieces of a country's Lore tab: the pages of `Category:<Country> lore` and the pages the owner added, without
 * the ones the owner hid or that no longer exist, each once under the title it leads to; pinned first, then by title.
 * Empty outside the default realm.
 */
export async function listLorePieces(ctx: LoreCtx, countryId: string): Promise<LorePiece[]> {
  const country = await loreCountry(countryId);
  if (country?.realmId !== DEFAULT_REALM_ID) return [];
  const [{ members }, rows] = await Promise.all([
    loadCategoryMembers({ category: loreCategory(country.name), limit: CATEGORY_LIMIT, type: "page" }),
    db.countryLorePage.findMany({
      where: { countryId },
      select: { title: true, type: true, pinned: true, hidden: true },
    }),
  ]);
  const curation = new Map(rows.map((row) => [row.title, row]));
  const candidates = new Set([
    ...members.map((member) => spaced(member.title)),
    ...rows.filter((row) => !row.hidden).map((row) => row.title),
  ]);
  const reads = await Promise.all(
    [...candidates]
      .filter((title) => !curation.get(title)?.hidden)
      .map(async (title) => ({ title, page: await readVisiblePage(ctx, title) }))
  );

  const pages = new Map<string, ListedPage>();
  for (const { title, page } of reads) {
    if (page.wikitext === null) continue;
    const listed = pages.get(page.resolvedTitle) ?? { wikitext: page.wikitext, rows: [] };
    for (const row of [curation.get(page.resolvedTitle), curation.get(title)]) {
      if (row && !listed.rows.includes(row)) listed.rows.push(row);
    }
    pages.set(page.resolvedTitle, listed);
  }
  return [...pages]
    .map(([title, page]) => toPiece(title, page, curation))
    .filter((piece): piece is LorePiece => piece !== null)
    .sort(byPinThenTitle);
}

// ── Curation ─────────────────────────────────────────────────────────────────

/** Record a piece the caller (owner or lore team) just wrote, with its type. */
export async function recordPiece(
  ctx: LoreCtx,
  countryId: string,
  input: { title: string; type: LoreType }
): Promise<{ title: string }> {
  const { userId } = await requireLore(ctx, countryId, "write");
  const title = canonicalTitleOf(input.title);
  await db.countryLorePage.upsert({
    where: titleKey(countryId, title),
    create: { countryId, title, type: input.type, addedById: userId },
    update: { type: input.type },
  });
  return { title };
}

/** The owner pins or hides a piece; a page with no curation yet gets one, typed from its infobox. */
export async function setCuration(
  ctx: LoreCtx,
  countryId: string,
  input: { title: string; pinned?: boolean; hidden?: boolean }
): Promise<{ title: string }> {
  const { userId } = await requireLore(ctx, countryId, "own");
  const title = canonicalTitleOf(input.title);
  const changes = { pinned: input.pinned, hidden: input.hidden };
  const row = await db.countryLorePage.findUnique({
    where: titleKey(countryId, title),
    select: { id: true },
  });
  if (row) {
    await db.countryLorePage.update({ where: titleKey(countryId, title), data: changes });
    return { title };
  }
  const page = await readVisiblePage(ctx, title);
  if (page.wikitext === null) throw noSuchPage();
  await db.countryLorePage.upsert({
    where: titleKey(countryId, page.resolvedTitle),
    create: {
      countryId,
      title: page.resolvedTitle,
      type: inferLoreType(page.wikitext),
      pinned: input.pinned ?? false,
      hidden: input.hidden ?? false,
      addedById: userId,
    },
    update: changes,
  });
  return { title: page.resolvedTitle };
}

/** The owner adds an existing wiki page to the Lore tab (no wiki edit), under the title it leads to. */
export async function addExistingPiece(
  ctx: LoreCtx,
  countryId: string,
  input: { title: string; type: LoreType }
): Promise<{ title: string }> {
  const { userId } = await requireLore(ctx, countryId, "own");
  const page = await readVisiblePage(ctx, canonicalTitleOf(input.title));
  if (page.wikitext === null) throw noSuchPage();
  const title = page.resolvedTitle;
  await db.countryLorePage.upsert({
    where: titleKey(countryId, title),
    create: { countryId, title, type: input.type, addedById: userId },
    update: { type: input.type, hidden: false },
  });
  return { title };
}

// ── Lore team ────────────────────────────────────────────────────────────────

/** The owner's view of the lore team, earliest added first. */
export async function listLoreTeam(
  ctx: LoreCtx,
  countryId: string,
  identity: Pick<LoreIdentity, "namesOf">
): Promise<LoreTeamMember[]> {
  await requireLore(ctx, countryId, "own");
  const rows = await db.countryLoreAuthor.findMany({
    where: { countryId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const names = await identity.namesOf(rows.map((row) => row.userId));
  return rows.flatMap(({ userId }) => {
    const name = names.get(userId);
    return name ? [{ userId, handle: name.handle, displayName: name.displayName }] : [];
  });
}

/** The owner adds a co-author by passport handle; never themself, the country's owner, or a member twice. */
export async function addLoreAuthor(
  ctx: LoreCtx,
  countryId: string,
  handle: string,
  identity: Pick<LoreIdentity, "userOfHandle">
): Promise<{ userId: string }> {
  const { userId: callerId, ownerUserId } = await requireLore(ctx, countryId, "own");
  const userId = await identity.userOfHandle(handle.trim());
  if (!userId) throw new TRPCError({ code: "NOT_FOUND", message: "No IxnayID has that handle." });
  if (userId === callerId || userId === ownerUserId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "They can already write this country's lore as its owner.",
    });
  }
  try {
    await db.countryLoreAuthor.create({ data: { countryId, userId, addedById: callerId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TRPCError({ code: "CONFLICT", message: "They are already on the lore team." });
    }
    throw error;
  }
  return { userId };
}

/** The owner removes a co-author, who loses writing on their next request. */
export async function removeLoreAuthor(
  ctx: LoreCtx,
  countryId: string,
  userId: string
): Promise<{ removed: boolean }> {
  await requireLore(ctx, countryId, "own");
  const { count } = await db.countryLoreAuthor.deleteMany({ where: { countryId, userId } });
  return { removed: count > 0 };
}
