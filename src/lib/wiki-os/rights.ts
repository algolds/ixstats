// src/lib/wiki-os/rights.ts
// The WikiOS rights engine: MediaWiki-style user groups and the rights each grants, merged with the
// IxStates (Clerk) role mapping. `GROUP_RIGHTS` is the single table to tune what a group may do.
//
// A user's groups are the union of
//   - the implicit groups: `*` (everyone), `user` (signed in), `autoconfirmed` (WikiOS's own rule: account
//     age and edits, the edits including every revision an approved name claim tagged);
//   - their explicit, non-expired `wiki_user_groups` rows, keyed by WikiOS user id or by an old IxWiki
//     name the account holds through an APPROVED claim (so a membership imported from MediaWiki applies
//     the moment its name is approved), but only a claim a system owner approved or linked (`rightsPass`,
//     plan 409): an ordinary admin's approval gives the name, never its imported groups. The passport
//     handle never attaches imported rows;
//   - the groups their IxStates role maps to (`ROLE_GROUP_MAP`).
// Imported blocks (`wiki_blocks` keyed by name) follow every approved claim, whoever approved it.
// Enforcement of an action against these rights lives in `permissions.ts`.

import { SYSTEM_OWNER_IDS, isSystemOwner } from "~/lib/auth";
import { db } from "~/server/db";
import {
  IXWIKI,
  claimName,
  namesOfUser,
  ownerOfName,
  type ClaimedName,
} from "~/lib/identity/wiki-names";
import { getWikiAuth, type WikiAuthContext } from "~/lib/wiki-os/auth";

/** Groups an administrator can grant explicitly (stored in `wiki_user_groups`). */
export const EXPLICIT_GROUPS = [
  "sysop",
  "bureaucrat",
  "interface-admin",
  "bot",
  "autoconfirmed",
  "confirmed",
  "rollbacker",
] as const;
export type ExplicitGroup = (typeof EXPLICIT_GROUPS)[number];
/** Every group: the two implicit ones plus the explicit ones. */
export type Group = "*" | "user" | ExplicitGroup;

export function isExplicitGroup(value: string): value is ExplicitGroup {
  return (EXPLICIT_GROUPS as readonly string[]).includes(value);
}

/** The MediaWiki rights WikiOS knows about (a subset of MediaWiki's own list). */
export type Right =
  | "read"
  | "edit"
  | "createpage"
  | "createtalk"
  | "move"
  | "move-subpages"
  | "move-rootuserpages"
  | "movefile"
  | "upload"
  | "reupload"
  | "editsemiprotected"
  | "editprotected"
  | "editinterface"
  | "editsitecss"
  | "editsitejs"
  | "editsitejson"
  | "editusercss"
  | "edituserjs"
  | "edituserjson"
  | "block"
  | "delete"
  | "undelete"
  | "deletedhistory"
  | "deletedtext"
  | "browsearchive"
  | "protect"
  | "rollback"
  | "import"
  | "importupload"
  | "suppressredirect"
  | "patrol"
  | "autopatrol"
  | "mergehistory"
  | "markbotedits"
  | "unwatchedpages"
  | "noratelimit"
  | "apihighlimits"
  | "bot"
  | "nominornewtalk"
  | "skipcaptcha"
  | "userrights";

/** What `autoconfirmed` (and its manual twin `confirmed`) may do that a brand-new account may not. */
const AUTOCONFIRMED_RIGHTS: readonly Right[] = [
  "move",
  "move-subpages",
  "upload",
  "reupload",
  "editsemiprotected",
  "skipcaptcha",
];

/**
 * Rights per group, mirroring MediaWiki's defaults (`MainConfigSchema::GroupPermissions`).
 * Deliberately absent: `editmyusercss/js/json`. WikiOS keeps plan 401's rule that user script, style
 * and data pages are interface-admin only, even on the owner's own user page.
 */
export const GROUP_RIGHTS: Readonly<Record<Group, readonly Right[]>> = {
  "*": ["read"],
  user: ["edit", "createpage", "createtalk"],
  autoconfirmed: AUTOCONFIRMED_RIGHTS,
  confirmed: AUTOCONFIRMED_RIGHTS,
  bot: ["bot", "autopatrol", "noratelimit", "apihighlimits", "nominornewtalk", "suppressredirect"],
  sysop: [
    ...AUTOCONFIRMED_RIGHTS,
    "block",
    "delete",
    "undelete",
    "deletedhistory",
    "deletedtext",
    "browsearchive",
    "protect",
    "editprotected",
    "editinterface", // not the CSS/JS/JSON interface pages: those are interface-admin
    "rollback",
    "import",
    "importupload",
    "move-rootuserpages",
    "movefile",
    "suppressredirect",
    "patrol",
    "autopatrol",
    "mergehistory",
    "noratelimit",
    "apihighlimits",
    "markbotedits",
    "unwatchedpages",
  ],
  "interface-admin": [
    "editinterface",
    "editsitecss",
    "editsitejs",
    "editsitejson",
    "editusercss",
    "edituserjs",
    "edituserjson",
  ],
  bureaucrat: ["userrights"],
  rollbacker: ["rollback"],
};

/** The groups a bureaucrat may add or remove (every other group is managed elsewhere). */
export const BUREAUCRAT_CHANGEABLE_GROUPS: readonly ExplicitGroup[] = [
  "bot",
  "sysop",
  "interface-admin",
  "bureaucrat",
  "autoconfirmed",
];

/** Groups a holder of the `userrights` right may add or remove; none for anyone else. */
export function changeableGroups(rights: ReadonlySet<Right>): readonly ExplicitGroup[] {
  return rights.has("userrights") ? BUREAUCRAT_CHANGEABLE_GROUPS : [];
}

/** The IxStates role (lower-case `Role.name`) to the groups it confers. A system owner counts as `owner`. */
export const ROLE_GROUP_MAP: Readonly<Record<string, readonly ExplicitGroup[]>> = {
  owner: ["sysop", "bureaucrat", "interface-admin"],
  admin: ["sysop"],
};

/** MediaWiki `$wgAutoConfirmAge` / `$wgAutoConfirmCount` equivalents: 4 days and 10 WikiOS edits. */
export const AUTOCONFIRM_AGE_MS = 4 * 24 * 60 * 60 * 1000;
export const AUTOCONFIRM_EDIT_COUNT = 10;

export interface GroupRow {
  group: string;
  expiresAt: Date | null;
}

export interface GroupResolutionInput {
  signedIn: boolean;
  /** When the account was created; null when unknown (never autoconfirms by age). */
  accountCreatedAt: Date | null;
  /** WikiOS edits (`wiki_revisions` by author id, claim-tagged revisions included) the account has made. */
  editCount: number;
  explicitGroups: readonly GroupRow[];
  roleName: string | null;
  isSystemOwner: boolean;
  now: Date;
}

/** Whether something that expires at `expiresAt` (null = never) is still in force at `now`. */
export function isActive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt > now;
}

function isAutoconfirmed(input: GroupResolutionInput): boolean {
  const { accountCreatedAt, editCount, now } = input;
  return (
    accountCreatedAt !== null &&
    now.getTime() - accountCreatedAt.getTime() >= AUTOCONFIRM_AGE_MS &&
    editCount >= AUTOCONFIRM_EDIT_COUNT
  );
}

function roleGroups(input: GroupResolutionInput): readonly ExplicitGroup[] {
  const roleKey = input.isSystemOwner ? "owner" : (input.roleName?.toLowerCase() ?? "");
  return Object.hasOwn(ROLE_GROUP_MAP, roleKey) ? ROLE_GROUP_MAP[roleKey]! : [];
}

/** Every group the subject is in right now. */
export function resolveGroups(input: GroupResolutionInput): Set<Group> {
  const groups = new Set<Group>(["*"]);
  if (input.signedIn) groups.add("user");
  if (input.signedIn && isAutoconfirmed(input)) groups.add("autoconfirmed");
  for (const row of input.explicitGroups) {
    if (isExplicitGroup(row.group) && isActive(row.expiresAt, input.now)) groups.add(row.group);
  }
  for (const group of roleGroups(input)) groups.add(group);
  return groups;
}

/** The union of the rights of `groups`. */
export function rightsForGroups(groups: Iterable<Group>): Set<Right> {
  const rights = new Set<Right>();
  for (const group of groups) {
    for (const right of GROUP_RIGHTS[group]) rights.add(right);
  }
  return rights;
}

export interface ActiveBlock {
  reason: string | null;
  /** null = indefinite. */
  expiresAt: Date | null;
  allowUserTalk: boolean;
}

export interface WikiPermissions {
  groups: Group[];
  rights: Set<Right>;
  block: ActiveBlock | null;
  /** Names whose User: pages are the subject's own: their handle (unless someone else holds that name) and their approved claims. */
  ownUserNames: string[];
}

/** Who to compute permissions for: a WikiOS user, or a wiki username nobody holds. */
export interface RightsSubject {
  /** WikiOS user id, or null for a wiki username nobody holds. */
  userId: string | null;
  signedIn: boolean;
  accountCreatedAt: Date | null;
  roleName: string | null;
  isSystemOwner: boolean;
  ownUserNames: string[];
  /** Names imported groups attach through: claims with rightsPass; for a name nobody holds, that name. */
  groupKeyNames: string[];
  /** Names imported blocks attach through: every approved claim; for a name nobody holds, that name. */
  blockKeyNames: string[];
}

/** The names imported rows attach to an account through (see `RightsSubject`). */
export type ClaimKeyNames = Pick<RightsSubject, "groupKeyNames" | "blockKeyNames">;

interface BlockRow {
  reason: string | null;
  expiresAt: Date | null;
  allowUserTalk: boolean;
}

/** `where` clauses for rows keyed by `userId` (when there is one) or by one of `names`. */
function rowKeys(userId: string | null, names: readonly string[]) {
  return [...(userId ? [{ userId }] : []), ...names.map((wikiUsername) => ({ wikiUsername }))];
}

/** Keys `wiki_user_groups` rows are matched by: the user id and the names a system owner gave the account. */
const groupKeys = (subject: RightsSubject) => rowKeys(subject.userId, subject.groupKeyNames);

/** Keys `wiki_blocks` rows are matched by: the user id and every name the account holds. */
const blockKeys = (subject: RightsSubject) => rowKeys(subject.userId, subject.blockKeyNames);

/** One block from the subject's active ones: indefinite beats dated, and user talk stays only if every block allows it. */
function mergeBlocks(rows: readonly BlockRow[]): ActiveBlock | null {
  const [first, ...rest] = rows;
  if (!first) return null;
  return rest.reduce<ActiveBlock>(
    (merged, row) => ({
      reason: merged.reason ?? row.reason,
      expiresAt:
        merged.expiresAt === null || row.expiresAt === null
          ? null
          : merged.expiresAt > row.expiresAt
            ? merged.expiresAt
            : row.expiresAt,
      allowUserTalk: merged.allowUserTalk && row.allowUserTalk,
    }),
    { reason: first.reason, expiresAt: first.expiresAt, allowUserTalk: first.allowUserTalk }
  );
}

/** WikiOS edits by the subject, counted only when the account is old enough for the count to matter. */
async function countEditsIfEligible(subject: RightsSubject, now: Date): Promise<number> {
  const { userId, accountCreatedAt } = subject;
  if (!userId || accountCreatedAt === null) return 0;
  if (now.getTime() - accountCreatedAt.getTime() < AUTOCONFIRM_AGE_MS) return 0;
  return db.wikiRevision.count({ where: { authorId: userId } });
}

/** Groups, rights and active block of `subject` at `now`. */
export async function loadSubjectPermissions(
  subject: RightsSubject,
  now: Date
): Promise<WikiPermissions> {
  const groupWhere = groupKeys(subject);
  const blockWhere = blockKeys(subject);
  const [explicitGroups, blocks, editCount] = await Promise.all([
    groupWhere.length
      ? db.wikiUserGroup.findMany({
          where: { OR: groupWhere },
          select: { group: true, expiresAt: true },
        })
      : [],
    blockWhere.length
      ? db.wikiBlock.findMany({
          where: { OR: blockWhere },
          select: { reason: true, expiresAt: true, allowUserTalk: true },
        })
      : [],
    countEditsIfEligible(subject, now),
  ]);
  const groups = resolveGroups({
    signedIn: subject.signedIn,
    accountCreatedAt: subject.accountCreatedAt,
    editCount,
    explicitGroups,
    roleName: subject.roleName,
    isSystemOwner: subject.isSystemOwner,
    now,
  });
  return {
    groups: [...groups],
    rights: rightsForGroups(groups),
    block: mergeBlocks(blocks.filter((block) => isActive(block.expiresAt, now))),
    ownUserNames: subject.ownUserNames,
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type ClaimStanding = ClaimKeyNames & Pick<RightsSubject, "ownUserNames">;

const NO_CLAIMS: ClaimStanding = { ownUserNames: [], groupKeyNames: [], blockKeyNames: [] };

/** Groups pass only through a claim a system owner decided (plan 409); blocks follow every approved claim. */
function keyNamesOf(claims: readonly ClaimedName[]): ClaimKeyNames {
  return {
    groupKeyNames: claims.filter((claim) => claim.rightsPass).map((claim) => claim.name),
    blockKeyNames: claims.map((claim) => claim.name),
  };
}

/** The names imported group and block rows attach to the account `userId` through (hidden claims included). */
export async function claimKeyNames(userId: string): Promise<ClaimKeyNames> {
  return keyNamesOf(await namesOfUser(db, userId));
}

/**
 * What the account's approved claims (hidden ones included) and its passport `handle` are worth to the rights
 * engine. The handle's page is the account's own unless another account holds that name; the handle never
 * attaches imported rows (anyone may pick a handle that spells an old sysop's name).
 */
async function claimStanding(userId: string | null, handle: string | null): Promise<ClaimStanding> {
  if (!userId) return NO_CLAIMS;
  const [claims, handleOwner] = await Promise.all([
    namesOfUser(db, userId),
    handle ? ownerOfName(db, IXWIKI, claimName(handle)) : null,
  ]);
  const ownsHandle = handle !== null && (handleOwner === null || handleOwner === userId);
  return {
    ...keyNamesOf(claims),
    ownUserNames: [...(ownsHandle ? [handle] : []), ...claims.map((claim) => claim.name)],
  };
}

async function loadCtxPermissions(ctx: WikiAuthContext): Promise<WikiPermissions> {
  const { internalUserId, userId, handle } = getWikiAuth(ctx);
  return loadSubjectPermissions(
    {
      userId: internalUserId,
      signedIn: userId !== null || internalUserId !== null,
      accountCreatedAt: toDate(ctx.user?.createdAt),
      roleName: ctx.user?.role?.name ?? null,
      isSystemOwner: userId !== null && isSystemOwner(userId),
      ...(await claimStanding(internalUserId, handle)),
    },
    new Date()
  );
}

/** One load per request context: a handler that checks several actions reads the database once. */
const permissionsByContext = new WeakMap<object, Promise<WikiPermissions>>();

/** The caller's groups, rights and active block. */
export function getWikiPermissions(ctx: WikiAuthContext): Promise<WikiPermissions> {
  const cached = permissionsByContext.get(ctx);
  if (cached) return cached;
  const loading = loadCtxPermissions(ctx);
  permissionsByContext.set(ctx, loading);
  return loading;
}

/**
 * Caps the rights `ctx` holds at `ceiling` (a bot password's grants: effective rights are the user's
 * rights intersected with the grants'). Every later `getWikiPermissions(ctx)`, `authorizeAction(ctx, ...)`
 * and `requireRight(ctx, ...)` on this context sees the capped rights; the groups are left as they are.
 */
export async function capWikiPermissions(
  ctx: WikiAuthContext,
  ceiling: ReadonlySet<Right>
): Promise<WikiPermissions> {
  const full = await getWikiPermissions(ctx);
  const capped: WikiPermissions = {
    ...full,
    rights: new Set([...full.rights].filter((right) => ceiling.has(right))),
  };
  permissionsByContext.set(ctx, Promise.resolve(capped));
  return capped;
}

/**
 * The permissions of the signed-in account `authId` (a Clerk user id), for callers outside tRPC, such as
 * API routes, that have no request context: it loads the user row the context would have carried.
 */
export async function getWikiPermissionsForAuthId(authId: string): Promise<WikiPermissions> {
  const user = await db.user.findUnique({
    where: { clerkUserId: authId },
    select: {
      id: true,
      clerkUserId: true,
      handle: true,
      createdAt: true,
      role: { select: { id: true, name: true, level: true } },
    },
  });
  return getWikiPermissions({ auth: { userId: authId }, user });
}

/**
 * Groups, rights and active block of someone other than the caller: the WikiOS user `userId` (null
 * when `wikiUsername` is a name nobody holds) known by `wikiUsername`.
 */
export async function loadTargetPermissions(
  target: { userId: string | null; wikiUsername: string },
  now = new Date()
): Promise<WikiPermissions> {
  const user = target.userId
    ? await db.user.findUnique({
        where: { id: target.userId },
        select: {
          createdAt: true,
          clerkUserId: true,
          handle: true,
          role: { select: { name: true } },
        },
      })
    : null;
  const unheld = [claimName(target.wikiUsername)].filter((name) => name !== "");
  return loadSubjectPermissions(
    {
      userId: target.userId,
      signedIn: user !== null,
      accountCreatedAt: user?.createdAt ?? null,
      roleName: user?.role?.name ?? null,
      // Not `isSystemOwner`: that logs an [AUDIT] line per call, and this runs for any profile anyone looks up.
      isSystemOwner: Boolean(user?.clerkUserId && SYSTEM_OWNER_IDS.includes(user.clerkUserId)),
      ...(target.userId
        ? await claimStanding(target.userId, user?.handle ?? null)
        : { ownUserNames: [], groupKeyNames: unheld, blockKeyNames: unheld }),
    },
    now
  );
}
