/**
 * Realm claims: "claim anything that already exists". Phase 1 claims existing countries. A claim is
 * auto-approved when the claimant's *verified* wiki account created the nation's wiki page; otherwise
 * it waits for a realm moderator (site admins for IxWorld, whose owner is "system").
 */
import type { PrismaClient } from "@prisma/client";
import {
  isProofSource,
  normalizeWikiUsername,
  type ProofSource,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { resolvePrimaryWikiUsername } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { canModerateRealm, isSiteAdmin, type RealmActor } from "./realms.access";
import { assignNation, NationOwnershipError } from "./realms.ownership";
import { realmSettings } from "./realms.settings";

export type ClaimErrorCode =
  "NOT_FOUND" | "ALREADY_OWNED" | "CAP_REACHED" | "FORBIDDEN" | "NOT_PENDING" | "REASON_REQUIRED";

export class ClaimError extends Error {
  constructor(
    public readonly code: ClaimErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export interface NationAssignedEvent {
  userId: string;
  clerkUserId: string;
  countryId: string;
  countryName: string;
}

export interface ClaimsDeps {
  fetchPageCreator: (source: ProofSource, title: string) => Promise<string | null>;
  /** Side effects linkCountry used to run: notification, one-time new-player bonus, profile cache. Runs after commit. */
  onNationAssigned: (event: NationAssignedEvent) => Promise<void>;
}

type ClaimsDb = Pick<
  PrismaClient,
  "country" | "user" | "wikiAccountLink" | "realmClaim" | "$transaction"
>;

const AUTO_REVIEWER = "system:auto";
const canonical = (name: string) =>
  normalizeWikiUsername(resolvePrimaryWikiUsername(normalizeWikiUsername(name)));

export function createClaimsService(db: ClaimsDb, deps: ClaimsDeps) {
  async function isVerifiedCreator(
    userId: string,
    country: { name: string; wikiSource: string | null; wikiPageTitle: string | null }
  ): Promise<boolean> {
    const source = country.wikiSource ?? "ixwiki";
    if (!isProofSource(source)) return false;
    const link = await db.wikiAccountLink.findFirst({
      where: { userId, source, verifiedAt: { not: null } },
    });
    if (!link) return false;
    try {
      const creator = await deps.fetchPageCreator(source, country.wikiPageTitle ?? country.name);
      return !!creator && canonical(creator) === canonical(link.username);
    } catch {
      return false; // wiki unreachable ⇒ fall back to manual review, never approve
    }
  }

  async function loadClaimable(actor: RealmActor, countryId: string) {
    const country = await db.country.findUnique({
      where: { id: countryId },
      select: {
        id: true,
        name: true,
        realmId: true,
        ownerUserId: true,
        wikiSource: true,
        wikiPageTitle: true,
        realm: { select: { settings: true } },
      },
    });
    if (!country) throw new ClaimError("NOT_FOUND", "Country not found");
    if (country.ownerUserId)
      throw new ClaimError("ALREADY_OWNED", "This nation already belongs to another player");
    const held = await db.country.count({
      where: { ownerUserId: actor.id, realmId: country.realmId },
    });
    if (held >= realmSettings(country.realm?.settings).maxNationsPerUser) {
      throw new ClaimError(
        "CAP_REACHED",
        "You already hold the maximum number of nations in this realm"
      );
    }
    return country;
  }

  async function claimCountry(actor: RealmActor, countryId: string) {
    const country = await loadClaimable(actor, countryId);
    const existing = await db.realmClaim.findFirst({
      where: { userId: actor.id, countryId, status: "pending" },
    });
    if (existing) return { claimId: existing.id, status: "pending" as const, autoApproved: false };

    if (!(await isVerifiedCreator(actor.id, country))) {
      const claim = await db.realmClaim.create({
        data: { realmId: country.realmId, userId: actor.id, countryId, status: "pending" },
      });
      return { claimId: claim.id, status: "pending" as const, autoApproved: false };
    }
    const claim = await db.$transaction(async (tx) => {
      const created = await tx.realmClaim.create({
        data: {
          realmId: country.realmId,
          userId: actor.id,
          countryId,
          status: "approved",
          autoApproved: true,
          reviewedBy: AUTO_REVIEWER,
          reviewedAt: new Date(),
        },
      });
      await assignNation(tx, { userId: actor.id, countryId });
      return created;
    });
    await deps.onNationAssigned({
      userId: actor.id,
      clerkUserId: actor.clerkUserId,
      countryId,
      countryName: country.name,
    });
    return { claimId: claim.id, status: "approved" as const, autoApproved: true };
  }

  async function reject(claimId: string, reviewer: string, reason: string) {
    await db.realmClaim.update({
      where: { id: claimId },
      data: {
        status: "rejected",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
    return { status: "rejected" as const };
  }

  async function reviewClaim(
    actor: RealmActor,
    claimId: string,
    decision: { approve: boolean; reason?: string }
  ) {
    const claim = await db.realmClaim.findUnique({
      where: { id: claimId },
      include: {
        realm: { select: { ownerId: true } },
        user: { select: { clerkUserId: true } },
        country: { select: { name: true } },
      },
    });
    if (!claim) throw new ClaimError("NOT_FOUND", "Claim not found");
    if (!canModerateRealm(actor, claim.realm))
      throw new ClaimError("FORBIDDEN", "Only this realm's moderators can review claims");
    if (claim.status !== "pending" || !claim.countryId)
      throw new ClaimError("NOT_PENDING", "This claim was already decided");
    if (!decision.approve) {
      const reason = decision.reason?.trim() ?? "";
      if (reason.length < 3) throw new ClaimError("REASON_REQUIRED", "Give the player a reason");
      return reject(claimId, actor.clerkUserId, reason);
    }
    const countryId = claim.countryId;
    try {
      await db.$transaction(async (tx) => {
        await assignNation(tx, { userId: claim.userId, countryId });
        await tx.realmClaim.update({
          where: { id: claimId },
          data: { status: "approved", reviewedBy: actor.clerkUserId, reviewedAt: new Date() },
        });
        await tx.realmClaim.updateMany({
          where: { countryId, status: "pending", id: { not: claimId } },
          data: {
            status: "rejected",
            reviewedBy: AUTO_REVIEWER,
            reviewedAt: new Date(),
            rejectionReason: "Another claim for this nation was approved",
          },
        });
      });
    } catch (error) {
      if (error instanceof NationOwnershipError) {
        const why =
          error.code === "ALREADY_OWNED"
            ? "The nation was taken by another player first"
            : error.message;
        return reject(claimId, AUTO_REVIEWER, `Automatically rejected: ${why}`);
      }
      throw error;
    }
    await deps.onNationAssigned({
      userId: claim.userId,
      clerkUserId: claim.user.clerkUserId,
      countryId,
      countryName: claim.country?.name ?? "",
    });
    return { status: "approved" as const };
  }

  async function listClaims(actor: RealmActor, status: string) {
    const scope = isSiteAdmin(actor) ? {} : { realm: { ownerId: actor.clerkUserId } };
    return db.realmClaim.findMany({
      where: { status, ...scope },
      orderBy: { createdAt: "asc" },
      include: {
        realm: { select: { id: true, name: true, slug: true } },
        country: { select: { id: true, name: true, slug: true, flag: true, wikiPageTitle: true } },
        user: { select: { id: true, clerkUserId: true, wikiUsername: true } },
      },
    });
  }

  async function myClaims(actor: RealmActor) {
    return db.realmClaim.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      include: {
        realm: { select: { name: true, slug: true } },
        country: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  return { claimCountry, reviewClaim, listClaims, myClaims };
}
