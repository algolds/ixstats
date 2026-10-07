/**
 * Realm claims: "claim anything that already exists" — an existing country, or a nation page in the realm's
 * lore index, whose approval creates the country (ruling E-f). A claim is auto-approved when the claimant's
 * *verified* wiki account created the nation's wiki page; otherwise it waits for a realm moderator (site
 * admins for IxWorld, whose owner is "system").
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo/sync";
import { parsePrismaError } from "~/lib/prisma-error";
import { generateSlug } from "~/lib/utils/slug-utils";
import {
  isProofSource,
  normalizeWikiUsername,
  type ProofSource,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { resolvePrimaryWikiUsername } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { assertCountryInFeatureRealm } from "~/server/shared/realm-link-guard";
import {
  canModerateRealm,
  hasRealmPower,
  isRealmOpen,
  isSiteAdmin,
  type RealmActor,
} from "./realms.access";
import { assignNation, NationOwnershipError } from "./realms.ownership";
import { capReachedMessage, nationCapacity } from "./realms.nation-cap";
import type { NationPagePrefill } from "./realms.prefill";

type ClaimErrorCode =
  | "NOT_FOUND"
  | "ALREADY_OWNED"
  | "CAP_REACHED"
  | "FORBIDDEN"
  | "NOT_PENDING"
  | "REASON_REQUIRED"
  | "REALM_CLOSED"
  | "SLUG_CONFLICT";

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

/** A claim turned down (by a moderator, or automatically when a rival claim won): the claimant is told why. */
export interface ClaimRejectedEvent {
  clerkUserId: string;
  nationName: string;
  realmSlug: string | null;
  reason: string;
}

interface ClaimsDeps {
  fetchPageCreator: (source: ProofSource, title: string) => Promise<string | null>;
  /** Side effects linkCountry used to run: notification, one-time new-player bonus, profile cache. Runs after commit. */
  onNationAssigned: (event: NationAssignedEvent) => Promise<void>;
  /** Tell a claimant their claim was rejected (AT-5). Runs after commit; failures never undo the decision. */
  onClaimRejected?: (event: ClaimRejectedEvent) => Promise<void>;
  /**
   * AT-3: what a nation page's infobox gives the country its approval creates (baseline and identity). Read
   * before the approving transaction; a failure creates the nation with the plain baseline.
   */
  fetchNationPrefill?: (wikiSource: string, title: string) => Promise<NationPagePrefill>;
}

type ClaimsDb = Pick<
  PrismaClient,
  "country" | "user" | "wikiAccountLink" | "realmClaim" | "realmPage" | "$transaction"
>;
type ClaimsTx = Pick<Prisma.TransactionClient, "country" | "user" | "realmClaim" | "mapLayer">;

/** A nation page of a realm's lore index — the claimable unit before its Country exists. */
interface NationPage {
  realmId: string;
  realmSlug: string;
  wikiSource: string;
  title: string;
}

/** What an approval hands over: an existing country, or a nation page whose country is created then. */
type ClaimTarget =
  | { kind: "country"; countryId: string; countryName: string; realmSlug: string | null }
  | { kind: "page"; page: NationPage };

interface ClaimDecision {
  status: "approved" | "rejected";
  reviewedBy: string;
  reviewedAt: Date;
  rejectionReason?: string;
  autoApproved?: boolean;
}

/** The claim row a claim files: its realm and claimant, plus the country or the nation page it asks for. */
interface FiledClaim {
  realmId: string;
  userId: string;
  countryId: string | null;
  wikiSource?: string;
  wikiPageTitle?: string;
}

const AUTO_REVIEWER = "system:auto";
const autoApproval = () => ({
  status: "approved" as const,
  autoApproved: true,
  reviewedBy: AUTO_REVIEWER,
  reviewedAt: new Date(),
});
/** Known alt accounts (KNOWN_WIKI_ALTS) are ixwiki accounts: on any other wiki the same name is someone else. */
const canonical = (source: ProofSource, name: string) => {
  const normalized = normalizeWikiUsername(name);
  return source === "ixwiki"
    ? normalizeWikiUsername(resolvePrimaryWikiUsername(normalized))
    : normalized;
};
const notPending = () => new ClaimError("NOT_PENDING", "This claim was already decided");
/** AT-7: only an active realm (or IxWorld) hands out nations; draft, generating and archived realms refuse claims. */
function assertRealmOpen(realmId: string, status: string | null | undefined): void {
  if (!isRealmOpen(realmId, status))
    throw new ClaimError("REALM_CLOSED", "This realm is not open for claims");
}
const pending = (claimId: string) => ({ claimId, status: "pending" as const, autoApproved: false });
const RIVAL_REJECTION = "Another claim for this nation was approved";
const rivalRejected = () => ({
  status: "rejected",
  reviewedBy: AUTO_REVIEWER,
  reviewedAt: new Date(),
  rejectionReason: RIVAL_REJECTION,
});

/** Turn away the other pending claims for a nation that was just handed over; returns their claimants. */
async function rejectRivals(tx: ClaimsTx, where: Prisma.RealmClaimWhereInput): Promise<string[]> {
  const rivals = await tx.realmClaim.findMany({
    where,
    select: { user: { select: { clerkUserId: true } } },
  });
  await tx.realmClaim.updateMany({ where, data: rivalRejected() });
  return (rivals ?? []).map((r) => r.user.clerkUserId);
}

/** What a hand-over produced: the nation, and the claimants whose rival claims it turned away. */
interface HandOver {
  country: { id: string; name: string };
  rivals: string[];
}

async function nationExists(
  client: Pick<PrismaClient, "country">,
  realmId: string,
  name: string
): Promise<boolean> {
  return !!(await client.country.findFirst({ where: { realmId, name }, select: { id: true } }));
}

const nationTaken = () =>
  new NationOwnershipError("ALREADY_OWNED", "This nation already belongs to another player");

/** Whether a unique violation is on Country.slug (Postgres names the column, or the constraint, as its target). */
function isSlugViolation(error: Error): boolean {
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const fields: unknown[] = Array.isArray(target) ? target : [target];
  return fields.some((field) => typeof field === "string" && field.includes("slug"));
}

/**
 * A concurrent approval that created the same (realm, name) first surfaces as a unique violation. A slug
 * taken between the free-slug search and the create is not that: it stays an error, so the claim stays pending
 * for another try instead of being rejected as another player's nation.
 */
function uniqueAsTaken(error: Error): never {
  if (parsePrismaError(error)?.type !== "unique_constraint") throw error;
  if (isSlugViolation(error)) {
    throw new ClaimError(
      "SLUG_CONFLICT",
      "The nation's URL slug was taken while it was being created; try again"
    );
  }
  throw nationTaken();
}

/**
 * The first free slug for a new nation: the title's slug, then -<realm slug> when that is taken elsewhere
 * (E-g), then -<realm slug>-2, -3… A title with no Latin letters or digits slugs to "nation".
 */
async function freeNationSlug(tx: ClaimsTx, page: NationPage): Promise<string> {
  const base = generateSlug(page.title) || "nation";
  const isTaken = async (slug: string) =>
    !!(await tx.country.findUnique({ where: { slug }, select: { id: true } }));
  if (!(await isTaken(base))) return base;
  const realmBase = `${base}-${page.realmSlug}`;
  let slug = realmBase;
  for (let n = 2; await isTaken(slug); n++) slug = `${realmBase}-${n}`;
  return slug;
}

/**
 * Ruling E-f: the claimed nation's Country with baseline data, prefilled from the page's infobox when it gave
 * anything (AT-3), at the first free slug (`freeNationSlug`).
 */
async function createNationCountry(
  tx: ClaimsTx,
  page: NationPage,
  prefill: NationPagePrefill | null
) {
  if (await nationExists(tx, page.realmId, page.title)) throw nationTaken();
  const slug = await freeNationSlug(tx, page);
  const identity = prefill && Object.keys(prefill.identity).length > 0 ? prefill.identity : null;
  return tx.country
    .create({
      data: {
        ...buildBaselineCountryData(page.title, prefill?.country),
        slug,
        realmId: page.realmId,
        wikiSource: page.wikiSource,
        wikiPageTitle: page.title,
        ...(identity && {
          nationalIdentity: { create: { countryName: page.title, ...identity } },
        }),
      },
      select: { id: true, name: true },
    })
    .catch(uniqueAsTaken);
}

/**
 * Decision 11: the realm's unlinked political region named after the nation (its feature id, or display name,
 * from the colour → nation mapping) becomes the new country's — linked, then its geometry synced, in the
 * approving transaction. No such region: nothing to link.
 */
async function takeMapRegion(tx: ClaimsTx, countryId: string, page: NationPage): Promise<void> {
  const unlinked = {
    realmId: page.realmId,
    layerType: "political",
    isActive: true,
    countryId: null,
  };
  const region = await tx.mapLayer.findFirst({
    where: { ...unlinked, OR: [{ featureId: page.title }, { displayName: page.title }] },
    select: { id: true },
  });
  if (!region) return;
  await assertCountryInFeatureRealm(tx, countryId, page.realmId);
  const { count } = await tx.mapLayer.updateMany({
    where: { ...unlinked, id: region.id },
    data: { countryId },
  });
  if (count > 0) await syncCountryGeometryFromMapLayer(tx, countryId);
}

/** Inside the approving transaction: hand the nation over and turn away rival pending claims for it. */
async function handOver(
  tx: ClaimsTx,
  claim: { id: string; userId: string },
  target: ClaimTarget,
  prefill: NationPagePrefill | null = null
): Promise<HandOver> {
  if (target.kind === "country") {
    await assignNation(tx, { userId: claim.userId, countryId: target.countryId });
    const rivals = await rejectRivals(tx, {
      countryId: target.countryId,
      status: "pending",
      id: { not: claim.id },
    });
    return { country: { id: target.countryId, name: target.countryName }, rivals };
  }
  const { page } = target;
  const country = await createNationCountry(tx, page, prefill);
  await assignNation(tx, { userId: claim.userId, countryId: country.id });
  await takeMapRegion(tx, country.id, page);
  await tx.realmClaim.update({ where: { id: claim.id }, data: { countryId: country.id } });
  const rivals = await rejectRivals(tx, {
    realmId: page.realmId,
    wikiPageTitle: page.title,
    status: "pending",
    id: { not: claim.id },
  });
  return { country, rivals };
}

const targetName = (target: ClaimTarget) =>
  target.kind === "country" ? target.countryName : target.page.title;
const targetRealmSlug = (target: ClaimTarget) =>
  target.kind === "country" ? target.realmSlug : target.page.realmSlug;

function claimTarget(claim: {
  realmId: string;
  countryId: string | null;
  wikiSource: string | null;
  wikiPageTitle: string | null;
  realm: { slug: string };
  country: { name: string } | null;
}): ClaimTarget | null {
  if (claim.countryId) {
    return {
      kind: "country",
      countryId: claim.countryId,
      countryName: claim.country?.name ?? "",
      realmSlug: claim.realm.slug,
    };
  }
  if (!claim.wikiPageTitle || !claim.wikiSource) return null;
  return {
    kind: "page",
    page: {
      realmId: claim.realmId,
      realmSlug: claim.realm.slug,
      wikiSource: claim.wikiSource,
      title: claim.wikiPageTitle,
    },
  };
}

/** A race lost inside an auto-approval surfaces as the matching claim error, never as a 500. */
function ownershipAsClaimError(error: Error): never {
  if (error instanceof NationOwnershipError && error.code !== "COUNTRY_NOT_FOUND") {
    throw new ClaimError(error.code, error.message);
  }
  throw error;
}

/**
 * pending → decided, guarded on the current status so overlapping reviews (READ COMMITTED) cannot both win.
 * Runs before any other write of a decision.
 */
async function decide(
  client: Pick<PrismaClient, "realmClaim">,
  claimId: string,
  data: ClaimDecision
): Promise<void> {
  const { count } = await client.realmClaim.updateMany({
    where: { id: claimId, status: "pending" },
    data,
  });
  if (count === 0) throw notPending();
}

/**
 * Inside an auto-approving transaction: the player's pending claim upgraded through the guarded decide (F-5.1),
 * or a new approved claim when they had none.
 */
async function approvedClaim(
  tx: ClaimsTx,
  filed: FiledClaim,
  pendingId: string | null
): Promise<{ id: string; userId: string }> {
  if (!pendingId) return tx.realmClaim.create({ data: { ...filed, ...autoApproval() } });
  await decide(tx, pendingId, autoApproval());
  return { id: pendingId, userId: filed.userId };
}

export function createClaimsService(db: ClaimsDb, deps: ClaimsDeps) {
  /** Tell each claimant why their claim was turned down; a failed notice is logged, never thrown. */
  async function notifyRejected(events: ClaimRejectedEvent[]): Promise<void> {
    if (!deps.onClaimRejected) return;
    for (const event of events) {
      await deps
        .onClaimRejected(event)
        .catch((e: Error) => console.error("[realms] claim rejection notice failed:", e));
    }
  }

  /** AT-3: a nation page's prefill, read before the approving transaction; null for an existing country. */
  async function prefillFor(target: ClaimTarget): Promise<NationPagePrefill | null> {
    if (target.kind !== "page" || !deps.fetchNationPrefill) return null;
    return deps.fetchNationPrefill(target.page.wikiSource, target.page.title).catch((e: Error) => {
      console.warn("[realms] nation page prefill failed:", e);
      return null;
    });
  }

  /** The rivals a hand-over turned away, told their claim lost. */
  const rivalNotices = (target: ClaimTarget, rivals: string[]): ClaimRejectedEvent[] =>
    rivals.map((clerkUserId) => ({
      clerkUserId,
      nationName: targetName(target),
      realmSlug: targetRealmSlug(target),
      reason: RIVAL_REJECTION,
    }));

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
      return !!creator && canonical(source, creator) === canonical(source, link.username);
    } catch {
      return false; // wiki unreachable ⇒ fall back to manual review, never approve
    }
  }

  async function assertUnderCap(
    actor: RealmActor,
    realmId: string,
    settings: Prisma.JsonValue | null | undefined
  ) {
    const capacity = await nationCapacity(db, { userId: actor.id, realmId, settings });
    if (!capacity.canTakeAnother) throw new ClaimError("CAP_REACHED", capReachedMessage(capacity));
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
        realm: { select: { settings: true, status: true, slug: true } },
      },
    });
    if (!country) throw new ClaimError("NOT_FOUND", "Country not found");
    assertRealmOpen(country.realmId, country.realm?.status);
    if (country.ownerUserId)
      throw new ClaimError("ALREADY_OWNED", "This nation already belongs to another player");
    await assertUnderCap(actor, country.realmId, country.realm?.settings);
    return country;
  }

  /**
   * The verified creator's claim is approved at once: a new approved claim, or the player's pending claim for the
   * same nation upgraded through the guarded decide (F-5.1 — never a duplicate). A race lost inside surfaces as a
   * claim error (F-5.3).
   */
  async function autoApprove(
    actor: RealmActor,
    filed: FiledClaim,
    pendingId: string | null,
    target: ClaimTarget
  ) {
    const prefill = await prefillFor(target);
    const { claimId, country, rivals } = await db
      .$transaction(async (tx) => {
        const claim = await approvedClaim(tx, filed, pendingId);
        return { claimId: claim.id, ...(await handOver(tx, claim, target, prefill)) };
      })
      .catch(ownershipAsClaimError);
    await notifyRejected(rivalNotices(target, rivals));
    await deps.onNationAssigned({
      userId: actor.id,
      clerkUserId: actor.clerkUserId,
      countryId: country.id,
      countryName: country.name,
    });
    return { claimId, status: "approved" as const, autoApproved: true };
  }

  /** File (or reuse) the player's claim; the verified creator's is approved at once, everyone else's waits. */
  async function fileClaim(
    actor: RealmActor,
    filed: FiledClaim,
    pendingWhere: Prisma.RealmClaimWhereInput,
    target: ClaimTarget,
    verified: boolean
  ) {
    const existing = await db.realmClaim.findFirst({
      where: { ...pendingWhere, userId: actor.id, status: "pending" },
    });
    if (verified) return autoApprove(actor, filed, existing?.id ?? null, target);
    if (existing) return pending(existing.id);
    const claim = await db.realmClaim.create({ data: { ...filed, status: "pending" } });
    return pending(claim.id);
  }

  async function claimCountry(actor: RealmActor, countryId: string) {
    const country = await loadClaimable(actor, countryId);
    return fileClaim(
      actor,
      { realmId: country.realmId, userId: actor.id, countryId },
      { countryId },
      {
        kind: "country",
        countryId,
        countryName: country.name,
        realmSlug: country.realm?.slug ?? null,
      },
      await isVerifiedCreator(actor.id, country)
    );
  }

  async function loadClaimablePage(
    actor: RealmActor,
    realmId: string,
    title: string
  ): Promise<NationPage> {
    const page = await db.realmPage.findFirst({
      where: { realmId, kind: "nation", title },
      select: {
        wikiSource: true,
        realm: { select: { slug: true, settings: true, status: true } },
      },
    });
    if (!page) throw new ClaimError("NOT_FOUND", "That page is not a nation of this realm");
    assertRealmOpen(realmId, page.realm.status);
    if (await nationExists(db, realmId, title))
      throw new ClaimError("ALREADY_OWNED", "This nation already belongs to another player");
    await assertUnderCap(actor, realmId, page.realm.settings);
    return { realmId, realmSlug: page.realm.slug, wikiSource: page.wikiSource, title };
  }

  /** Claim a nation page of the realm's lore index; approval (now or by review) creates its Country. */
  async function claimNationPage(actor: RealmActor, realmId: string, title: string) {
    const page = await loadClaimablePage(actor, realmId, title);
    const verified = await isVerifiedCreator(actor.id, {
      name: title,
      wikiSource: page.wikiSource,
      wikiPageTitle: title,
    });
    return fileClaim(
      actor,
      {
        realmId,
        userId: actor.id,
        countryId: null,
        wikiSource: page.wikiSource,
        wikiPageTitle: title,
      },
      { realmId, wikiPageTitle: title },
      { kind: "page", page },
      verified
    );
  }

  /** Reject a pending claim with a reason, then tell its claimant (AT-5). */
  async function reject(
    claimId: string,
    reviewer: string,
    reason: string,
    notice: Omit<ClaimRejectedEvent, "reason">
  ) {
    await decide(db, claimId, {
      status: "rejected",
      reviewedBy: reviewer,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });
    await notifyRejected([{ ...notice, reason }]);
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
        realm: {
          select: {
            ownerId: true,
            slug: true,
            status: true,
            // Only the reviewer's own grant matters: an officer holding `claims` reviews this realm's claims.
            officers: {
              where: { userId: actor.clerkUserId },
              select: { userId: true, powers: true },
            },
          },
        },
        user: { select: { clerkUserId: true } },
        country: { select: { name: true } },
      },
    });
    if (!claim) throw new ClaimError("NOT_FOUND", "Claim not found");
    if (!hasRealmPower(actor, claim.realm, claim.realm.officers, "claims"))
      throw new ClaimError("FORBIDDEN", "Only this realm's moderators can review claims");
    // Officers can't approve their own claims; the founder and site admins can.
    if (
      decision.approve &&
      claim.user.clerkUserId === actor.clerkUserId &&
      !canModerateRealm(actor, claim.realm)
    )
      throw new ClaimError(
        "FORBIDDEN",
        "The founder or another reviewer must approve your own claim"
      );
    const target = claimTarget(claim);
    if (claim.status !== "pending" || !target) throw notPending();
    const notice = {
      clerkUserId: claim.user.clerkUserId,
      nationName: targetName(target),
      realmSlug: claim.realm.slug,
    };
    if (!decision.approve) {
      const reason = decision.reason?.trim() ?? "";
      if (reason.length < 3) throw new ClaimError("REASON_REQUIRED", "Give the player a reason");
      return reject(claimId, actor.clerkUserId, reason, notice);
    }
    // A claim filed before the realm closed can still be rejected, but no longer approved.
    assertRealmOpen(claim.realmId, claim.realm.status);
    const prefill = await prefillFor(target);
    let handed: HandOver;
    try {
      handed = await db.$transaction(async (tx) => {
        await decide(tx, claimId, {
          status: "approved",
          reviewedBy: actor.clerkUserId,
          reviewedAt: new Date(),
        });
        return handOver(tx, claim, target, prefill);
      });
    } catch (error) {
      if (error instanceof NationOwnershipError) {
        const why =
          error.code === "ALREADY_OWNED"
            ? "The nation was taken by another player first"
            : error.message;
        return reject(claimId, AUTO_REVIEWER, `Automatically rejected: ${why}`, notice);
      }
      throw error;
    }
    const { country, rivals } = handed;
    await notifyRejected(rivalNotices(target, rivals));
    await deps.onNationAssigned({
      userId: claim.userId,
      clerkUserId: claim.user.clerkUserId,
      countryId: country.id,
      countryName: country.name,
    });
    return { status: "approved" as const };
  }

  async function listClaims(actor: RealmActor, status: string) {
    // The founder's realms, and the realms where the caller is an officer holding `claims`.
    const scope = isSiteAdmin(actor)
      ? {}
      : {
          realm: {
            OR: [
              { ownerId: actor.clerkUserId },
              { officers: { some: { userId: actor.clerkUserId, powers: { has: "claims" } } } },
            ],
          },
        };
    return db.realmClaim.findMany({
      where: { status, ...scope },
      orderBy: { createdAt: "asc" },
      include: {
        realm: { select: { id: true, name: true, slug: true } },
        country: { select: { id: true, name: true, slug: true, flag: true, wikiPageTitle: true } },
        user: {
          select: {
            id: true,
            clerkUserId: true,
            wikiUsername: true,
            // Only proven accounts identify the claimant; wikiUsername is the legacy, unverified column.
            wikiAccountLinks: {
              where: { verifiedAt: { not: null } },
              select: { source: true, username: true },
            },
          },
        },
      },
    });
  }

  /**
   * The player's own claims, newest first, with their status and (once rejected) the reason — optionally in one
   * realm (AT-5). Only the claimant's own rows; reviewer ids stay internal.
   */
  async function myClaims(actor: RealmActor, realmSlug?: string) {
    return db.realmClaim.findMany({
      where: { userId: actor.id, ...(realmSlug && { realm: { slug: realmSlug } }) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        autoApproved: true,
        rejectionReason: true,
        wikiPageTitle: true,
        createdAt: true,
        reviewedAt: true,
        realm: { select: { name: true, slug: true } },
        country: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  return { claimCountry, claimNationPage, reviewClaim, listClaims, myClaims };
}
