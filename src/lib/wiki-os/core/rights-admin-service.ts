/**
 * rights-admin-service.ts — WikiOS page protection, blocks, group changes and the public log.
 *
 * The writes behind `protectPage`, `blockUser`, `unblockUser` and `setUserGroups`; callers have already
 * been authorized (see `permissions.ts`). Every change is one transaction that also appends its
 * `wiki_logs` row, written with user NAMES only: nothing here ever returns an internal or auth-provider id.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  accountOfWikiName,
  claimName,
  namesOfUsers,
  primaryNameOf,
} from "~/lib/identity/wiki-names";
import type { RestrictionLevel, RestrictionType } from "~/lib/wiki-os/permissions";
import { claimKeyNames, isActive, type ExplicitGroup } from "~/lib/wiki-os/rights";
import { enqueueProtectJob, scheduleMirrorKick } from "../services/mirror-outbox";
import {
  legacyProtectionLevel,
  PageOperationError,
  type PageActor,
} from "./page-management-service";

/** A user to act on: a WikiOS user, or a wiki username that may not belong to anyone. */
export type UserTarget = { userId: string } | { wikiUsername: string };

export interface ResolvedTarget {
  userId: string | null;
  /** The wiki username a new row is also keyed by, when known. */
  wikiUsername: string | null;
  /** What logs and lists show. */
  displayName: string;
}

export interface RestrictionChange {
  action: RestrictionType;
  /** null removes the restriction. */
  level: RestrictionLevel | null;
  expiresAt: Date | null;
}

export interface PublicRestriction {
  action: string;
  level: string;
  expiresAt: Date | null;
  reason: string | null;
  setBy: string | null;
}

export interface PublicBlock {
  target: string;
  reason: string | null;
  expiresAt: Date | null;
  allowUserTalk: boolean;
  blockedBy: string | null;
  createdAt: Date;
}

export const LOG_TYPES = ["move", "delete", "protect", "upload", "rights", "block"] as const;
export type LogType = (typeof LOG_TYPES)[number];

export interface PublicLogEntry {
  id: string;
  type: string;
  action: string;
  title: string;
  actor: string;
  comment: string | null;
  params: Prisma.JsonValue | null;
  timestamp: Date;
}

export interface LogQuery {
  type?: LogType;
  /** Canonical title. */
  title?: string;
  /** Acting user's name. */
  user?: string;
  limit: number;
  cursor?: string;
}

/**
 * `where` clauses matching the target's `kind` rows: its user id and the names the rights engine attaches them
 * through (`claimKeyNames`: groups only through a claim a system owner decided, blocks through every approved
 * claim). A block also matches the target's own name; a name nobody holds is its own key.
 */
async function keysOf(
  target: Pick<ResolvedTarget, "userId" | "wikiUsername">,
  kind: "groups" | "blocks"
) {
  const ownName = target.wikiUsername ? [target.wikiUsername] : [];
  if (!target.userId) return ownName.map((wikiUsername) => ({ wikiUsername }));
  const names = await claimKeyNames(target.userId);
  const keyNames = kind === "groups" ? names.groupKeyNames : [...names.blockKeyNames, ...ownName];
  return [
    { userId: target.userId },
    ...[...new Set(keyNames)].map((wikiUsername) => ({ wikiUsername })),
  ];
}

export class RightsAdminService {
  /**
   * The user `target` names. A wiki username resolves to the account holding its approved claim, else the
   * account whose handle it spells, if any; a user id must exist. Throws NOT_FOUND for a user id nobody has.
   */
  static async resolveTarget(target: UserTarget): Promise<ResolvedTarget> {
    if ("wikiUsername" in target) {
      const wikiUsername = claimName(target.wikiUsername);
      const account = await accountOfWikiName(db, wikiUsername);
      return { userId: account?.userId ?? null, wikiUsername, displayName: wikiUsername };
    }
    const [user, primaryName] = await Promise.all([
      db.user.findUnique({ where: { id: target.userId }, select: { handle: true } }),
      primaryNameOf(db, target.userId, { shown: true }),
    ]);
    if (!user) throw new PageOperationError("NOT_FOUND", "No such user.");
    return {
      userId: target.userId,
      wikiUsername: primaryName,
      displayName: user.handle ?? primaryName ?? "Unknown user",
    };
  }

  /**
   * `resolveTarget` for a lookup `viewerId` makes: a name held only through a hidden claim answers as a name nobody
   * holds, except to its holder. Blocks and group changes act on the unfiltered `resolveTarget`.
   */
  static async resolveShownTarget(
    wikiUsername: string,
    viewerId: string | null
  ): Promise<ResolvedTarget> {
    const target = await this.resolveTarget({ wikiUsername });
    if (target.userId === viewerId) return target;
    const shown = await accountOfWikiName(db, wikiUsername, { shown: true });
    return shown ? target : { ...target, userId: null };
  }

  /**
   * The names users go by in logs and lists: the passport handle, else the first name the account shows. An id
   * with no user row is absent from the map.
   */
  static async displayNames(userIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const [users, names] = await Promise.all([
      db.user.findMany({ where: { id: { in: ids } }, select: { id: true, handle: true } }),
      namesOfUsers(db, ids, { shown: true }),
    ]);
    return new Map(
      users.map((user) => [user.id, user.handle ?? names.get(user.id)?.[0]?.name ?? "Unknown user"])
    );
  }

  /** Set or remove page restrictions on `title` and keep the article's mirrored `protectionLevel` in step. */
  static async protect(params: {
    title: string;
    changes: readonly RestrictionChange[];
    reason: string;
    actor: PageActor;
    realm?: string;
  }): Promise<void> {
    const { title, changes, reason, actor, realm = "ixwiki" } = params;
    await db.$transaction(async (tx) => {
      for (const change of changes) {
        const key = { source: realm, title, action: change.action };
        if (change.level === null) {
          await tx.wikiRestriction.deleteMany({ where: key });
          continue;
        }
        const data = {
          level: change.level,
          expiresAt: change.expiresAt,
          setById: actor.userId,
          reason: reason || null,
        };
        await tx.wikiRestriction.upsert({
          where: { source_title_action: key },
          create: { ...key, ...data },
          update: data,
        });
      }

      const article = await tx.wikiArticle.findUnique({
        where: { source_title: { source: realm, title } },
        select: { id: true },
      });
      const edit = changes.find((change) => change.action === "edit");
      if (article && edit) {
        await tx.wikiArticle.update({
          where: { id: article.id },
          data: {
            protectionLevel: legacyProtectionLevel(edit.level ?? undefined),
            protectionExpiry: edit.level ? edit.expiresAt : null,
          },
        });
      }

      const restrictions = changes.map((change) => ({
        action: change.action,
        level: change.level,
        expiresAt: change.expiresAt?.toISOString() ?? null,
      }));
      const log = await tx.wikiLog.create({
        data: {
          logType: "protect",
          action: changes.some((change) => change.level !== null) ? "protect" : "unprotect",
          title,
          actorName: actor.name,
          comment: reason,
          params: { restrictions },
          userId: actor.userId,
          articleId: article?.id ?? null,
        },
        select: { id: true },
      });
      await enqueueProtectJob(tx, {
        title,
        articleId: article?.id ?? null,
        logId: log.id,
        source: realm,
        reason,
        restrictions,
      });
    });
    scheduleMirrorKick();
  }

  /** The restrictions on `title` that are in force now, each with the name of who set it. */
  static async getRestrictions(title: string, realm = "ixwiki"): Promise<PublicRestriction[]> {
    const rows = await db.wikiRestriction.findMany({ where: { source: realm, title } });
    const now = new Date();
    const active = rows.filter((row) => isActive(row.expiresAt, now));
    const names = await this.displayNames(active.flatMap((row) => row.setById ?? []));
    return active.map((row) => ({
      action: row.action,
      level: row.level,
      expiresAt: row.expiresAt,
      reason: row.reason,
      setBy: (row.setById && names.get(row.setById)) || null,
    }));
  }

  /** Block `target`, or change their existing block. Returns the name blocked. */
  static async block(params: {
    target: UserTarget;
    reason: string;
    expiresAt: Date | null;
    allowUserTalk: boolean;
    actor: PageActor;
  }): Promise<string> {
    const { reason, expiresAt, allowUserTalk, actor } = params;
    const target = await this.resolveTarget(params.target);
    if (target.userId === actor.userId) {
      throw new PageOperationError("BAD_REQUEST", "You cannot block yourself.");
    }
    const keys = await keysOf(target, "blocks");
    const now = new Date();

    await db.$transaction(async (tx) => {
      const rows = await tx.wikiBlock.findMany({ where: { OR: keys } });
      const existing = rows.find((row) => isActive(row.expiresAt, now));
      const data = { reason: reason || null, expiresAt, allowUserTalk, blockedById: actor.userId };
      if (existing) {
        await tx.wikiBlock.update({ where: { id: existing.id }, data });
      } else {
        await tx.wikiBlock.create({
          data: { ...data, userId: target.userId, wikiUsername: target.wikiUsername },
        });
      }
      await tx.wikiLog.create({
        data: {
          logType: "block",
          action: existing ? "reblock" : "block",
          title: `User:${target.displayName}`,
          actorName: actor.name,
          comment: reason,
          params: { expiry: expiresAt?.toISOString() ?? "infinity", allowUserTalk },
          userId: actor.userId,
        },
      });
    });
    return target.displayName;
  }

  /** Remove every block on `target`. Throws NOT_FOUND when they are not blocked. Returns the name unblocked. */
  static async unblock(params: {
    target: UserTarget;
    reason: string;
    actor: PageActor;
  }): Promise<string> {
    const { reason, actor } = params;
    const target = await this.resolveTarget(params.target);
    const keys = await keysOf(target, "blocks");
    const now = new Date();

    await db.$transaction(async (tx) => {
      const rows = await tx.wikiBlock.findMany({ where: { OR: keys } });
      if (!rows.some((row) => isActive(row.expiresAt, now))) {
        throw new PageOperationError("NOT_FOUND", `${target.displayName} is not blocked.`);
      }
      await tx.wikiBlock.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
      await tx.wikiLog.create({
        data: {
          logType: "block",
          action: "unblock",
          title: `User:${target.displayName}`,
          actorName: actor.name,
          comment: reason,
          userId: actor.userId,
        },
      });
    });
    return target.displayName;
  }

  /** The blocks in force now, newest first, a page of `limit` after `cursor`. */
  static async listBlocks(
    limit: number,
    cursor?: string
  ): Promise<{ blocks: PublicBlock[]; nextCursor: string | null }> {
    const rows = await db.wikiBlock.findMany({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const names = await this.displayNames(
      page.flatMap((row) => [row.userId, row.blockedById]).filter((id): id is string => id !== null)
    );
    const nameOf = (id: string | null) => (id && names.get(id)) || null;
    return {
      blocks: page.map((row) => ({
        target: row.wikiUsername ?? nameOf(row.userId) ?? "Unknown user",
        reason: row.reason,
        expiresAt: row.expiresAt,
        allowUserTalk: row.allowUserTalk,
        blockedBy: nameOf(row.blockedById),
        createdAt: row.createdAt,
      })),
      nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
    };
  }

  /** The explicit (non-expired) group memberships the rights engine gives `target` (see `keysOf`). */
  static async explicitGroups(
    target: Pick<ResolvedTarget, "userId" | "wikiUsername">
  ): Promise<Array<{ group: string; expiresAt: Date | null }>> {
    const keys = await keysOf(target, "groups");
    if (keys.length === 0) return [];
    const rows = await db.wikiUserGroup.findMany({
      where: { OR: keys },
      select: { group: true, expiresAt: true },
    });
    const now = new Date();
    return rows.filter((row) => isActive(row.expiresAt, now));
  }

  /** Add and remove explicit groups for `target`. The caller has checked the groups are theirs to change. */
  static async setGroups(params: {
    target: UserTarget;
    add: readonly ExplicitGroup[];
    remove: readonly ExplicitGroup[];
    expiresAt: Date | null;
    reason: string;
    actor: PageActor;
  }): Promise<string> {
    const { add, remove, expiresAt, reason, actor } = params;
    const overlap = add.find((group) => remove.includes(group));
    if (overlap) {
      throw new PageOperationError("BAD_REQUEST", `"${overlap}" cannot be both added and removed.`);
    }
    if (add.length + remove.length === 0) {
      throw new PageOperationError("BAD_REQUEST", "Name a group to add or remove.");
    }
    const target = await this.resolveTarget(params.target);
    const keys = await keysOf(target, "groups");

    await db.$transaction(async (tx) => {
      for (const group of add) await this.grant(tx, target, group, expiresAt, actor);
      if (remove.length > 0) {
        await tx.wikiUserGroup.deleteMany({ where: { group: { in: [...remove] }, OR: keys } });
      }
      await tx.wikiLog.create({
        data: {
          logType: "rights",
          action: "rights",
          title: `User:${target.displayName}`,
          actorName: actor.name,
          comment: reason,
          params: { added: add, removed: remove, expiresAt: expiresAt?.toISOString() ?? null },
          userId: actor.userId,
        },
      });
    });
    return target.displayName;
  }

  private static async grant(
    tx: Prisma.TransactionClient,
    target: ResolvedTarget,
    group: ExplicitGroup,
    expiresAt: Date | null,
    actor: PageActor
  ): Promise<void> {
    const data = { expiresAt, addedById: actor.userId };
    if (target.userId) {
      await tx.wikiUserGroup.upsert({
        where: { userId_group: { userId: target.userId, group } },
        create: { userId: target.userId, group, ...data },
        update: data,
      });
    } else if (target.wikiUsername) {
      await tx.wikiUserGroup.upsert({
        where: { wikiUsername_group: { wikiUsername: target.wikiUsername, group } },
        create: { wikiUsername: target.wikiUsername, group, ...data },
        update: data,
      });
    }
  }

  /** A page of the public log, newest first. `nextCursor` continues it. */
  static async getLog(
    query: LogQuery
  ): Promise<{ entries: PublicLogEntry[]; nextCursor: string | null }> {
    const { type, title, user, limit, cursor } = query;
    const rows = await db.wikiLog.findMany({
      where: {
        ...(type ? { logType: type } : {}),
        ...(title ? { title } : {}),
        ...(user ? { actorName: user } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        logType: true,
        action: true,
        title: true,
        actorName: true,
        comment: true,
        params: true,
        createdAt: true,
      },
    });
    return {
      entries: rows.slice(0, limit).map((row) => ({
        id: row.id,
        type: row.logType,
        action: row.action,
        title: row.title,
        actor: row.actorName,
        comment: row.comment,
        params: row.params,
        timestamp: row.createdAt,
      })),
      nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
    };
  }
}
