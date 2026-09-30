// src/lib/wiki-os/permissions.ts
// Enforcement of a WikiOS action against the caller's rights (`rights.ts`). Every WikiOS write goes
// through `authorizeAction`; it throws FORBIDDEN with a MediaWiki-style reason code in the message:
//   blocked              the caller is blocked
//   namespaceprotected   the page's namespace needs a right the caller lacks (namespace-policy.ts)
//   protectedpage        a page protection (edit / move / upload) needs a level the caller lacks
//   titleprotected       the title is create-protected
//   permissiondenied     the caller lacks the action's own right
// In that order: a block beats everything, the namespace beats protection, and the action's own right
// is checked last.

import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  checkEditPolicy,
  isOwnUserSpace,
  parseWikiTitle,
  type EditPolicyResult,
} from "~/lib/wiki-os/namespace-policy";
import {
  changeableGroups,
  getWikiPermissions,
  isActive,
  type ActiveBlock,
  type ExplicitGroup,
  type Right,
  type WikiPermissions,
} from "~/lib/wiki-os/rights";

export type WikiAction =
  "edit" | "create" | "move" | "delete" | "undelete" | "protect" | "rollback" | "upload" | "import";

/** What a page protection restricts. */
export type RestrictionType = "edit" | "move" | "create" | "upload";

/** The protection levels an administrator can set; `null` (no restriction) is an absent row. */
export const RESTRICTION_LEVELS = ["autoconfirmed", "sysop"] as const;
export type RestrictionLevel = (typeof RESTRICTION_LEVELS)[number];

export interface PageRestriction {
  action: string;
  level: string;
  expiresAt: Date | null;
}

export type DenialCode =
  "blocked" | "namespaceprotected" | "protectedpage" | "titleprotected" | "permissiondenied";

export type ActionDecision =
  { allowed: true } | { allowed: false; code: DenialCode; reason: string };

/** The rights an action needs on top of the namespace and protection checks. */
const ACTION_RIGHTS: Readonly<Record<WikiAction, readonly Right[]>> = {
  edit: ["edit"],
  create: ["edit"], // plus createpage / createtalk, see requiredRights
  move: ["move"],
  delete: ["delete"],
  undelete: ["undelete"],
  protect: ["protect"],
  rollback: ["rollback", "edit"], // a rollback is an edit
  upload: ["upload"],
  import: ["import"],
};

/**
 * The protections that hold an action back. Creating is held by create-protection AND by an edit
 * restriction: restriction rows are keyed by title and outlive a delete, and a wrong "does the page
 * exist" answer must never open a protected page.
 *
 * ponytail: cascading protection (a page transcluded by a cascade-protected page) is not enforced;
 * it needs plan 406's `wiki_template_links` table. Until then protectPage refuses `cascade: true`
 * and no cascade flag is stored; a `cascadeprotected` denial code joins DenialCode with the lookup.
 */
const RESTRICTIONS_FOR_ACTION: Readonly<Record<WikiAction, readonly RestrictionType[]>> = {
  edit: ["edit"],
  create: ["create", "edit"],
  move: ["move"],
  rollback: ["edit"],
  upload: ["upload", "edit"], // a re-upload also rewrites the File: page, which its edit protection guards
  delete: [],
  undelete: [],
  protect: [],
  import: [],
};

/** The right that satisfies a protection `level`. An unknown level fails closed (sysop). */
export function rightForLevel(level: string): Right {
  return level === "autoconfirmed" ? "editsemiprotected" : "editprotected";
}

const isTalkNamespace = (namespaceId: number): boolean => namespaceId % 2 === 1;

function requiredRights(action: WikiAction, namespaceId: number): readonly Right[] {
  if (action !== "create") return ACTION_RIGHTS[action];
  return [...ACTION_RIGHTS.create, isTalkNamespace(namespaceId) ? "createtalk" : "createpage"];
}

const deny = (code: DenialCode, reason: string): ActionDecision => ({
  allowed: false,
  code,
  reason,
});

function describeBlock(block: ActiveBlock): string {
  const until = block.expiresAt ? ` until ${block.expiresAt.toISOString()}` : "";
  const why = block.reason ? ` Reason: ${block.reason}` : "";
  return `You are blocked from editing${until}.${why}`;
}

/** A blocked user whose block allows it may still edit their own user talk page (to appeal). */
function isOwnUserTalkEdit(
  action: WikiAction,
  title: string,
  block: ActiveBlock,
  verifiedWikiUsername: string | null
): boolean {
  if (!block.allowUserTalk || (action !== "edit" && action !== "create")) return false;
  const parsed = parseWikiTitle(title);
  // Only a verified wiki account has an identity that could own a talk page.
  return parsed?.namespaceId === 3 && isOwnUserSpace(parsed.base, verifiedWikiUsername);
}

function checkRestrictions(
  action: WikiAction,
  restrictions: readonly PageRestriction[],
  rights: ReadonlySet<Right>,
  now: Date
): ActionDecision | null {
  for (const type of RESTRICTIONS_FOR_ACTION[action]) {
    const restriction = restrictions.find((r) => r.action === type && isActive(r.expiresAt, now));
    if (restriction && !rights.has(rightForLevel(restriction.level))) {
      return type === "create"
        ? deny("titleprotected", `This title is protected from creation (${restriction.level}).`)
        : deny("protectedpage", `This page is protected from ${type} (${restriction.level}).`);
    }
  }
  return null;
}

export interface ActionRequest {
  action: WikiAction;
  /** Canonical title. */
  title: string;
  permissions: WikiPermissions;
  /** The page's protections (any action; expired ones are ignored). */
  restrictions: readonly PageRestriction[];
  now: Date;
}

/** Whether the caller in `request.permissions` may perform `request.action` on `request.title`. */
export function decideAction(request: ActionRequest): ActionDecision {
  const { action, title, permissions, restrictions, now } = request;
  const { block, rights, verifiedWikiUsername } = permissions;

  if (block && !isOwnUserTalkEdit(action, title, block, verifiedWikiUsername)) {
    return deny("blocked", describeBlock(block));
  }

  // An upload needs the upload right, not the right to edit the File: page it creates.
  if (action !== "upload") {
    const policy = checkEditPolicy(title, { rights, linkedWikiUsername: verifiedWikiUsername });
    if (!policy.allowed) return deny("namespaceprotected", policy.reason);
  }

  const restricted = checkRestrictions(action, restrictions, rights, now);
  if (restricted) return restricted;

  const namespaceId = parseWikiTitle(title)?.namespaceId ?? 0;
  const missing = requiredRights(action, namespaceId).find((right) => !rights.has(right));
  return missing
    ? deny(
        "permissiondenied",
        `You do not have the "${missing}" right needed to ${action} this page.`
      )
    : { allowed: true };
}

function forbidden(code: DenialCode, reason: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message: `${code}: ${reason}` });
}

/** The canonical title of what the client sent; BAD_REQUEST when MediaWiki would refuse it. */
export function requireCanonicalTitle(rawTitle: string, source = "ixwiki"): string {
  const canon = canonicalizeTitle(rawTitle, { source });
  if (!canon)
    throw new TRPCError({ code: "BAD_REQUEST", message: "That page title is not valid." });
  return canon.title;
}

/**
 * The canonical `File:` title MediaWiki gives an upload named `rawFilename`, which is the title its
 * rights are checked against: the part after the last `/` or `\\`, with `:` and the characters a title
 * cannot hold turned into `-` (so "Template:Foo.png" is `File:Template-Foo.png`, never a Template: page).
 * BAD_REQUEST when nothing usable is left.
 */
export function requireUploadTitle(rawFilename: string): string {
  const base = rawFilename.split(/[\\/]/).pop() ?? "";
  const name = base.replace(/[\u0000-\u001F\u007F:#<>[\]{}|]/g, "-").trim();
  return requireCanonicalTitle(`File:${name}`);
}

/** Turn a page-service refusal (no such page, the destination exists) into the matching TRPCError. */
export async function refusals<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof PageOperationError) {
      throw new TRPCError({ code: error.code, message: error.message });
    }
    throw error;
  }
}

/**
 * Throws FORBIDDEN (reason code first in the message) unless the caller may perform `action` on
 * `rawTitle`. Pass "create" for a page that does not exist yet and "edit" for one that does. The title
 * is canonicalized here too, so no spelling can dodge a title-keyed protection.
 */
export async function authorizeAction(
  ctx: WikiAuthContext,
  action: WikiAction,
  rawTitle: string,
  source = "ixwiki"
): Promise<void> {
  const title = requireCanonicalTitle(rawTitle, source);
  const permissions = await getWikiPermissions(ctx);
  const restrictions =
    RESTRICTIONS_FOR_ACTION[action].length > 0
      ? await db.wikiRestriction.findMany({
          where: { source, title },
          select: { action: true, level: true, expiresAt: true },
        })
      : [];
  const decision = decideAction({ action, title, permissions, restrictions, now: new Date() });
  if (!decision.allowed) throw forbidden(decision.code, decision.reason);
}

/** Throws FORBIDDEN (`blocked`) when the caller is blocked: for writes that are not page edits, such as margin discussions and annotations. */
export async function requireNotBlocked(ctx: WikiAuthContext): Promise<void> {
  const { block } = await getWikiPermissions(ctx);
  if (block) throw forbidden("blocked", describeBlock(block));
}

/** Throws FORBIDDEN (`permissiondenied`) unless the caller holds `right`; returns their permissions. */
export async function requireRight(ctx: WikiAuthContext, right: Right): Promise<WikiPermissions> {
  const permissions = await getWikiPermissions(ctx);
  if (!permissions.rights.has(right)) {
    throw forbidden("permissiondenied", `You do not have the "${right}" right.`);
  }
  return permissions;
}

/** Throws FORBIDDEN unless the caller holds `userrights` and every one of `groups` is theirs to change. */
export async function requireGroupChange(
  ctx: WikiAuthContext,
  groups: readonly ExplicitGroup[]
): Promise<void> {
  const { rights } = await requireRight(ctx, "userrights");
  const allowed = changeableGroups(rights);
  const refused = groups.find((group) => !allowed.includes(group));
  if (refused) {
    throw forbidden("permissiondenied", `You cannot add or remove the "${refused}" group.`);
  }
}

/** Whether the caller holds `deletedhistory`: only they can see that a deleted (archived) page exists. */
export async function canSeeDeletedPages(ctx: WikiAuthContext): Promise<boolean> {
  return (await getWikiPermissions(ctx)).rights.has("deletedhistory");
}

/** Throws NOT_FOUND for a deleted (archived) page unless the reader holds `deletedhistory`: to everyone else it does not exist. */
export async function assertPageVisible(
  ctx: WikiAuthContext,
  article: { status: string } | null,
  title: string
): Promise<void> {
  if (article?.status !== "ARCHIVED") return;
  if (!(await canSeeDeletedPages(ctx))) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `The page "${title}" does not exist on IxWiki.`,
    });
  }
}

/** The status of the page `rawTitle` names, found as `ArticleRepository.findBySlug` finds it: the exact title, else the one row whose slug matches. */
async function pageStatus(rawTitle: string, source: string): Promise<string | null> {
  const canon = canonicalizeTitle(rawTitle, { source });
  if (!canon) return null;
  const exact = await db.wikiArticle.findUnique({
    where: { source_title: { source, title: canon.title } },
    select: { status: true },
  });
  if (exact) return exact.status;
  const variants = await db.wikiArticle.findMany({
    where: { source, slug: canon.slug },
    take: 2,
    select: { status: true },
  });
  return variants.length === 1 ? (variants[0]?.status ?? null) : null;
}

/** `assertPageVisible` for a read that has only a title: looks the page's status up first. */
export async function assertTitleVisible(
  ctx: WikiAuthContext,
  rawTitle: string,
  source = "ixwiki"
): Promise<void> {
  const status = await pageStatus(rawTitle, source);
  await assertPageVisible(ctx, status ? { status } : null, rawTitle);
}

/** Whether the caller may see the page `rawTitle` names: false only for a deleted page and a reader without `deletedhistory`. */
export async function canSeeTitle(
  ctx: WikiAuthContext,
  rawTitle: string,
  source = "ixwiki"
): Promise<boolean> {
  try {
    await assertTitleVisible(ctx, rawTitle, source);
    return true;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") return false;
    throw error;
  }
}

/** `rawTitles` without the deleted pages this caller may not see (all of them, for a reader with `deletedhistory`). */
export async function visibleTitles(
  ctx: WikiAuthContext,
  rawTitles: readonly string[],
  source = "ixwiki"
): Promise<string[]> {
  const titles = rawTitles.flatMap((raw) => canonicalizeTitle(raw, { source })?.title ?? []);
  if (titles.length === 0) return [...rawTitles];
  if (await canSeeDeletedPages(ctx)) return [...rawTitles];
  const rows = await db.wikiArticle.findMany({
    where: { source, status: "ARCHIVED", title: { in: titles } },
    select: { title: true },
  });
  const hidden = new Set(rows.map((row) => row.title));
  return rawTitles.filter((raw) => !hidden.has(canonicalizeTitle(raw, { source })?.title ?? ""));
}

/**
 * May a dump import the page `title` (canonical, stored in `namespaceId`) for the caller in
 * `permissions`? The same block and namespace rules as `decideAction` for an import: Template:,
 * Module:, MediaWiki: pages and the like need `editprotected`, site and user script/style/data pages
 * need their interface-admin right. A namespace this wiki does not know (the dump's own prefix) is
 * administrators' only.
 */
export function importVerdict(
  permissions: WikiPermissions,
  title: string,
  namespaceId: number,
  now = new Date()
): EditPolicyResult {
  const namespaceKnown = namespaceId === (parseWikiTitle(title)?.namespaceId ?? 0);
  if (!namespaceKnown && !permissions.rights.has("editprotected")) {
    return {
      allowed: false,
      reason: "Only wiki administrators can import pages in this namespace.",
    };
  }
  const decision = decideAction({ action: "import", title, permissions, restrictions: [], now });
  return decision.allowed ? { allowed: true } : { allowed: false, reason: decision.reason };
}
