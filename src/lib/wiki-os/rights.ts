// src/lib/wiki-os/rights.ts
// The WikiOS rights engine: MediaWiki-style user groups and the rights each grants, merged with the
// IxStates (Clerk) role mapping. `GROUP_RIGHTS` is the single table to tune what a group may do.
//
// A user's groups are the union of
//   - the implicit groups: `*` (everyone), `user` (signed in), `autoconfirmed` (see below);
//   - their explicit, non-expired `wiki_user_groups` rows, keyed by WikiOS user id or by the
//     MediaWiki username of their VERIFIED wiki link (so a membership imported from MediaWiki for a
//     name nobody has linked yet applies the moment the link is verified), but only when the link
//     was proven by the account's own token or confirmed by a system owner: a link an ordinary admin
//     confirmed proves nothing about who owns the wiki account, so it never inherits pending rows;
//   - the groups their IxStates role maps to (`ROLE_GROUP_MAP`).
// Enforcement of an action against these rights lives in `permissions.ts`.

import { SYSTEM_OWNER_IDS, isSystemOwner } from "~/lib/auth";
import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { getWikiAuth, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { getVerifiedWikiLink } from "~/lib/wiki-os/storage";

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

/**
 * Whether the wiki account behind a verified link is at least `AUTOCONFIRM_AGE_MS` old and has
 * `AUTOCONFIRM_EDIT_COUNT` edits, as recorded when the link was proven. A link without that record
 * (an older link, or an admin's) proves identity only: autoconfirmed then comes from WikiOS's own rule.
 */
export function mwAccountAutoconfirms(
  link: { mwRegisteredAt: Date | null; mwEditCount: number | null },
  now: Date
): boolean {
  return (
    link.mwRegisteredAt !== null &&
    now.getTime() - link.mwRegisteredAt.getTime() >= AUTOCONFIRM_AGE_MS &&
    (link.mwEditCount ?? 0) >= AUTOCONFIRM_EDIT_COUNT
  );
}

export interface GroupRow {
  group: string;
  expiresAt: Date | null;
}

export interface GroupResolutionInput {
  signedIn: boolean;
  /** When the account was created; null when unknown (never autoconfirms by age). */
  accountCreatedAt: Date | null;
  /** WikiOS edits (`wiki_revisions` by author) the account has made. */
  editCount: number;
  /** The user's verified wiki link is to an account that is itself old and active enough (see `mwAccountAutoconfirms`). */
  linkAutoconfirms: boolean;
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
  if (input.linkAutoconfirms) return true;
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
  /** The verified wiki account name (null = none); what "my own user page" means. */
  verifiedWikiUsername: string | null;
}

/** Who to compute permissions for: a WikiOS user, and/or a wiki username that may not be linked yet. */
export interface RightsSubject {
  /** WikiOS user id, or null for a wiki username nobody has linked. */
  userId: string | null;
  signedIn: boolean;
  accountCreatedAt: Date | null;
  roleName: string | null;
  isSystemOwner: boolean;
  /** The verified wiki account name (own user page); null = no verified link. */
  verifiedWikiUsername: string | null;
  /**
   * The wiki username pending group and block rows attach through: the verified name when the link
   * was proven by the account's own token or confirmed by a system owner; null for a link an
   * ordinary admin confirmed (an admin must not be able to claim a name that holds imported groups).
   * For a wiki username nobody has linked it is that name.
   */
  pendingKeyUsername: string | null;
  linkAutoconfirms: boolean;
}

interface BlockRow {
  reason: string | null;
  expiresAt: Date | null;
  allowUserTalk: boolean;
}

/** Keys `wiki_user_groups` and `wiki_blocks` rows are matched by: the user id and the wiki username. */
function identityKeys(subject: RightsSubject) {
  return [
    ...(subject.userId ? [{ userId: subject.userId }] : []),
    ...(subject.pendingKeyUsername
      ? [{ wikiUsername: normalizeWikiUsername(subject.pendingKeyUsername) }]
      : []),
  ];
}

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
  const { userId, accountCreatedAt, linkAutoconfirms } = subject;
  if (!userId || linkAutoconfirms || accountCreatedAt === null) return 0;
  if (now.getTime() - accountCreatedAt.getTime() < AUTOCONFIRM_AGE_MS) return 0;
  return db.wikiRevision.count({ where: { authorId: userId } });
}

/** Groups, rights and active block of `subject` at `now`. */
export async function loadSubjectPermissions(
  subject: RightsSubject,
  now: Date
): Promise<WikiPermissions> {
  const keys = identityKeys(subject);
  const [explicitGroups, blocks, editCount] = await Promise.all([
    keys.length
      ? db.wikiUserGroup.findMany({ where: { OR: keys }, select: { group: true, expiresAt: true } })
      : [],
    keys.length
      ? db.wikiBlock.findMany({
          where: { OR: keys },
          select: { reason: true, expiresAt: true, allowUserTalk: true },
        })
      : [],
    countEditsIfEligible(subject, now),
  ]);
  const groups = resolveGroups({
    signedIn: subject.signedIn,
    accountCreatedAt: subject.accountCreatedAt,
    editCount,
    linkAutoconfirms: subject.linkAutoconfirms,
    explicitGroups,
    roleName: subject.roleName,
    isSystemOwner: subject.isSystemOwner,
    now,
  });
  return {
    groups: [...groups],
    rights: rightsForGroups(groups),
    block: mergeBlocks(blocks.filter((block) => isActive(block.expiresAt, now))),
    verifiedWikiUsername: subject.verifiedWikiUsername,
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type LinkStanding = Pick<
  RightsSubject,
  "verifiedWikiUsername" | "pendingKeyUsername" | "linkAutoconfirms"
>;

const NO_LINK: LinkStanding = {
  verifiedWikiUsername: null,
  pendingKeyUsername: null,
  linkAutoconfirms: false,
};

/** Whether the WikiOS user `verifierId` is a system owner (the non-logging check, see `loadTargetPermissions`). */
async function isSystemOwnerUser(verifierId: string): Promise<boolean> {
  const verifier = await db.user.findUnique({
    where: { id: verifierId },
    select: { clerkUserId: true },
  });
  return Boolean(verifier?.clerkUserId && SYSTEM_OWNER_IDS.includes(verifier.clerkUserId));
}

/** What the user's verified wiki link is worth to the rights engine, and through which name it may attach pending rows. */
async function linkStanding(userId: string | null, now: Date): Promise<LinkStanding> {
  const link = userId ? await getVerifiedWikiLink(userId) : null;
  if (!link) return NO_LINK;
  const trusted = link.verifiedById === null || (await isSystemOwnerUser(link.verifiedById));
  return {
    verifiedWikiUsername: link.username,
    pendingKeyUsername: trusted ? link.username : null,
    linkAutoconfirms: mwAccountAutoconfirms(link, now),
  };
}

async function loadCtxPermissions(ctx: WikiAuthContext): Promise<WikiPermissions> {
  const { internalUserId, userId } = getWikiAuth(ctx);
  const now = new Date();
  return loadSubjectPermissions(
    {
      userId: internalUserId,
      signedIn: userId !== null || internalUserId !== null,
      accountCreatedAt: toDate(ctx.user?.createdAt),
      roleName: ctx.user?.role?.name ?? null,
      isSystemOwner: userId !== null && isSystemOwner(userId),
      ...(await linkStanding(internalUserId, now)),
    },
    now
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
      createdAt: true,
      role: { select: { id: true, name: true, level: true } },
    },
  });
  return getWikiPermissions({ auth: { userId: authId }, user });
}

/**
 * Groups, rights and active block of someone other than the caller: the WikiOS user `userId` (null
 * when `wikiUsername` is a wiki account nobody has linked) known by `wikiUsername`.
 */
export async function loadTargetPermissions(
  target: { userId: string | null; wikiUsername: string },
  now = new Date()
): Promise<WikiPermissions> {
  const user = target.userId
    ? await db.user.findUnique({
        where: { id: target.userId },
        select: { createdAt: true, clerkUserId: true, role: { select: { name: true } } },
      })
    : null;
  return loadSubjectPermissions(
    {
      userId: target.userId,
      signedIn: user !== null,
      accountCreatedAt: user?.createdAt ?? null,
      roleName: user?.role?.name ?? null,
      // Not `isSystemOwner`: that logs an [AUDIT] line per call, and this runs for any profile anyone looks up.
      isSystemOwner: Boolean(user?.clerkUserId && SYSTEM_OWNER_IDS.includes(user.clerkUserId)),
      ...(target.userId
        ? await linkStanding(target.userId, now)
        : { ...NO_LINK, pendingKeyUsername: target.wikiUsername }),
    },
    now
  );
}
