/**
 * Handing a realm to a new founder (`Realm.ownerId`). Site admins transfer any realm from /admin/realms; a
 * founder hands their own realm to a nation owner or officer of it from the Manage tab. Both are confirmed by
 * typing the realm's slug, recorded in `AdminAuditLog` with the previous owner, and tell the people involved.
 * The previous founder loses the founder's powers, or stays on as an officer holding every power.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  FORMER_FOUNDER_TITLE,
  MAX_OFFICERS,
  REALM_POWERS,
  STAFF_FOUNDER_ID,
} from "~/lib/realms/realm-region";
import { isSiteAdmin, type RealmActor } from "./realms.access";
import { notifyRealmFounderChanged } from "./realms.notices";
import { RealmRegionError, requireRealmStaff } from "./realms.region";
import type { BoardGrantGuard } from "./realms.region-actions";

type TransferDb = Pick<
  PrismaClient,
  "realm" | "realmOfficer" | "country" | "user" | "adminAuditLog" | "$transaction"
>;

/** `AdminAuditLog.action` of a realm handover; `changes` holds the previous and new owner. */
export const REALM_OWNER_TRANSFER_ACTION = "REALM_OWNER_TRANSFERRED";

interface TransferRealm {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  officers: ReadonlyArray<{ userId: string }>;
}

interface TransferChoice {
  /** The new founder's Clerk id; `null` hands the realm back to staff (site admins only). */
  newOwnerId: string | null;
  confirmSlug: string;
  keepPreviousAsOfficer: boolean;
}

function requireTypedSlug(realm: { slug: string }, typed: string) {
  if (typed.trim() !== realm.slug)
    throw new RealmRegionError("BAD_REQUEST", `Type the realm's slug (${realm.slug}) to confirm`);
}

async function requireActiveUser(db: TransferDb, clerkUserId: string) {
  const user = await db.user.findUnique({ where: { clerkUserId }, select: { isActive: true } });
  if (!user) throw new RealmRegionError("NOT_FOUND", "No user with that id");
  if (!user.isActive) throw new RealmRegionError("BAD_REQUEST", "That account is deactivated");
}

async function applyTransfer(
  db: TransferDb,
  actor: RealmActor,
  realm: TransferRealm,
  choice: TransferChoice,
  via: "admin" | "founder"
) {
  const previousOwnerId = realm.ownerId;
  const newOwnerId = choice.newOwnerId ?? STAFF_FOUNDER_ID;
  if (newOwnerId === previousOwnerId)
    throw new RealmRegionError("BAD_REQUEST", "That account already founds the realm");
  const keep = choice.keepPreviousAsOfficer && previousOwnerId !== STAFF_FOUNDER_ID;
  if (keep) {
    const others = realm.officers.filter(
      (o) => o.userId !== newOwnerId && o.userId !== previousOwnerId
    );
    if (others.length >= MAX_OFFICERS)
      throw new RealmRegionError(
        "BAD_REQUEST",
        `The realm already has ${MAX_OFFICERS} officers: remove one first, or don't keep the previous founder as an officer`
      );
  }

  await db.$transaction(async (tx) => {
    await tx.realm.update({ where: { id: realm.id }, data: { ownerId: newOwnerId } });
    // The founder holds every power already; drop a now-redundant officer post.
    await tx.realmOfficer.deleteMany({ where: { realmId: realm.id, userId: newOwnerId } });
    if (keep) {
      const post = {
        title: FORMER_FOUNDER_TITLE,
        powers: [...REALM_POWERS],
        appointedBy: actor.clerkUserId,
      };
      await tx.realmOfficer.upsert({
        where: { realmId_userId: { realmId: realm.id, userId: previousOwnerId } },
        create: { realmId: realm.id, userId: previousOwnerId, ...post },
        update: post,
      });
    }
    await tx.adminAuditLog.create({
      data: {
        action: REALM_OWNER_TRANSFER_ACTION,
        targetType: "realm",
        targetId: realm.id,
        targetName: realm.name,
        changes: JSON.stringify({ previousOwnerId, newOwnerId, keptPreviousAsOfficer: keep, via }),
        adminId: actor.id,
        adminName: actor.clerkUserId,
      },
    });
  });

  // A failing notice never undoes the handover.
  const notices = [
    newOwnerId !== STAFF_FOUNDER_ID &&
      notifyRealmFounderChanged({
        clerkUserId: newOwnerId,
        role: "new",
        realmName: realm.name,
        realmSlug: realm.slug,
        keptAsOfficer: false,
      }),
    previousOwnerId !== STAFF_FOUNDER_ID &&
      previousOwnerId !== actor.clerkUserId &&
      notifyRealmFounderChanged({
        clerkUserId: previousOwnerId,
        role: "previous",
        realmName: realm.name,
        realmSlug: realm.slug,
        keptAsOfficer: keep,
      }),
  ].filter((notice): notice is Promise<void> => notice !== false);
  await Promise.all(
    notices.map((notice) =>
      notice.catch((e: Error) => console.error("[realms] handover notice failed:", e))
    )
  );
  return { success: true, previousOwnerId, newOwnerId, keptPreviousAsOfficer: keep };
}

/**
 * Site admins: hand a realm to a player (an existing, active account) or back to staff (`newOwnerId: null`),
 * confirmed by typing its slug. IxWorld stays staff-administered.
 */
export async function adminTransferRealmOwner(
  db: TransferDb,
  actor: RealmActor,
  input: TransferChoice & { realmId: string },
  guardBoard: BoardGrantGuard
) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site admins transfer realms");
  const realm = await db.realm.findUnique({
    where: { id: input.realmId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      officers: { select: { userId: true } },
    },
  });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  requireTypedSlug(realm, input.confirmSlug);
  if (input.newOwnerId) {
    if (realm.id === DEFAULT_REALM_ID)
      throw new RealmRegionError("BAD_REQUEST", "IxWorld is administered by IxStats staff");
    await requireActiveUser(db, input.newOwnerId);
    // A founder holds the board power (M9).
    await guardBoard(realm.id, input.newOwnerId);
  }
  return applyTransfer(db, actor, realm, input, "admin");
}

/** The realm, if `actor` is its founder (site admins transfer from /admin/realms instead). */
async function requireFounder(db: TransferDb, actor: RealmActor, slug: string) {
  const realm = await requireRealmStaff(db, actor, slug, "founder");
  if (realm.ownerId !== actor.clerkUserId)
    throw new RealmRegionError("FORBIDDEN", "Only the realm's founder can hand it over");
  return realm;
}

/**
 * The founder hands their realm to a player who owns a nation in it or is one of its officers, confirmed by
 * typing its slug; `keepPreviousAsOfficer` keeps them on as an officer with every power.
 */
export async function handOverRealm(
  db: TransferDb,
  actor: RealmActor,
  input: { slug: string; newOwnerId: string; confirmSlug: string; keepPreviousAsOfficer: boolean },
  guardBoard: BoardGrantGuard
) {
  const realm = await requireFounder(db, actor, input.slug);
  requireTypedSlug(realm, input.confirmSlug);
  if (input.newOwnerId === actor.clerkUserId)
    throw new RealmRegionError("BAD_REQUEST", "You already found this realm");
  await requireActiveUser(db, input.newOwnerId);
  if (!realm.officers.some((o) => o.userId === input.newOwnerId)) {
    const nation = await db.country.findFirst({
      where: { realmId: realm.id, owner: { clerkUserId: input.newOwnerId } },
      select: { id: true },
    });
    if (!nation)
      throw new RealmRegionError(
        "BAD_REQUEST",
        "The new founder must own a nation in the realm or be one of its officers"
      );
  }
  await guardBoard(realm.id, input.newOwnerId);
  return applyTransfer(db, actor, realm, input, "founder");
}

/** Founder: players who own a nation in the realm and could take it over, matched by nation name. */
export async function listHandOverCandidates(
  db: TransferDb,
  actor: RealmActor,
  input: { slug: string; query: string }
) {
  const realm = await requireFounder(db, actor, input.slug);
  const query = input.query.trim();
  const nations = await db.country.findMany({
    where: {
      realmId: realm.id,
      owner: { clerkUserId: { not: actor.clerkUserId }, isActive: true },
      ...(query && { name: { contains: query, mode: "insensitive" } }),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { name: true, owner: { select: { clerkUserId: true } } },
  });
  const seen = new Set<string>();
  const candidates: Array<{ userId: string; nation: string }> = [];
  for (const nation of nations) {
    const userId = nation.owner?.clerkUserId;
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    candidates.push({ userId, nation: nation.name });
  }
  return candidates;
}
