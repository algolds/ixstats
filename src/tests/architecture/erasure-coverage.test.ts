/** @jest-environment node */
/**
 * Schema guard for Privacy 5.2 account erasure: every Prisma model with a user-identifying String column must
 * either be swept by the erasure modules (`account-erasure.records.ts`, `account-erasure.market.ts`,
 * `realms.erasure.ts`, `realms.transfer.ts`) or be listed in `KEPT` with the reason its rows stay. "Swept" means the
 * sources call `tx.<delegate>.` or `db.<delegate>.`; a comment or a type name does not count. A call is the guard's
 * evidence, not proof of what it does: the erasure tests assert the behaviour.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SCHEMA_DIR = join(ROOT, "prisma/schema");

const ERASURE_FILES = [
  "src/server/orchestration/account-erasure.records.ts",
  "src/server/orchestration/account-erasure.market.ts",
  "src/server/modules/realms/realms.erasure.ts",
  "src/server/modules/realms/realms.transfer.ts",
];

/** A `String`/`String?` schema field: its name is captured. */
const STRING_FIELD_RE = /^\s*(\w+)\s+String\??\b/;

/** User-identifying column names that do not end in a known suffix. */
const USER_COLUMN_NAMES = new Set([
  "userId",
  "clerkUserId",
  "createdBy",
  "createdById",
  "submittedBy",
  "requestedBy",
  "uploadedBy",
  "proposedBy",
  "authorId",
  "ownerId",
  "founderId",
  "voterId",
  "sellerId",
  "buyerId",
  "bidderId",
  "initiatorId",
  "recipientId",
  "reporterId",
  "uploaderId",
]);

/** Compound names: `buyerUserId`, `fromUserId`, `uploaderClerkId`, `followerClerkUserId`, `authorUserId`, ... */
const USER_COLUMN_SUFFIX_RE = /(UserId|ClerkId|ClerkUserId)$/;

/**
 * Staff-action columns: the reviewer, moderator or resolver of someone else's record, not the user it is about.
 * They match the patterns above only by accident (`reviewedByUserId`), so they are excluded by name.
 */
const STAFF_ACTION_COLUMNS = new Set([
  "reviewedBy",
  "reviewedById",
  "reviewedByUserId",
  "moderatorId",
  "moderatorUserId",
  "resolvedBy",
  "resolvedById",
  "resolvedByUserId",
  "decidedBy",
  "decidedById",
  "decidedByUserId",
  "approvedBy",
  "approvedById",
  "approvedByUserId",
  "closedBy",
  "closedByUserId",
]);

const isUserColumn = (name: string) =>
  !STAFF_ACTION_COLUMNS.has(name) && (USER_COLUMN_NAMES.has(name) || USER_COLUMN_SUFFIX_RE.test(name));

/** Models whose rows are intentionally kept on the tombstoned User (or hold non-user entity ids). */
const KEPT: Record<string, string> = {
  // Moderation and safety records kept under Privacy 5.2(5)
  RealmBoardBan: "Realm board ban record (createdBy is the issuing moderator); kept under Privacy 5.2(5).",
  ForumReport: "Forum moderation report (reporterId); kept under Privacy 5.2(5).",
  ForumWarning: "Forum moderation warning; kept under Privacy 5.2(5).",
  ForumBan: "Forum moderation ban; kept under Privacy 5.2(5).",
  ForumAppeal: "Forum moderation appeal; kept under Privacy 5.2(5).",
  PostFlag: "ThinkPages post moderation flag; kept under Privacy 5.2(5).",
  WikiBlock: "Wiki moderation block record; kept under Privacy 5.2(5).",
  CardInscriptionReport: "Card inscription moderation report; kept under Privacy 5.2(5).",

  // Wiki history (CC BY-SA, Privacy 5.2(4)) and Collaborative Works (Privacy 5.2(2))
  WikiArticle: "Wiki article metadata (authorId); kept under CC BY-SA (Privacy 5.2(4)).",
  WikiRevision: "Wiki revision history (authorId); kept under CC BY-SA (Privacy 5.2(4)).",
  WikiLog: "Wiki operational log; kept with wiki history (Privacy 5.2(4)).",
  WikiAsset: "Uploaded wiki media asset (uploaderId); kept under CC BY-SA (Privacy 5.2(4)).",
  BlurbPrompt: "Shared writing prompt (createdBy); Collaborative Work kept under Privacy 5.2(2).",
  BlurbResponse: "Shared blurb response on the tombstoned User; Collaborative Work kept under Privacy 5.2(2).",
  ForumPostMention: "Mention target on a forum post; post text stays and the target User row is tombstoned.",

  // Onoma lexicons & reviews stay attached to the tombstoned User so forks do not cascade
  LanguagePack: "Onoma language pack kept on the tombstoned User so downstream forks remain intact.",
  LanguagePackReview: "Onoma pack review kept on the tombstoned User (account-erasure.records.ts).",
  NameBank: "Onoma name bank kept with the tombstoned User's language pack data.",
  EtymologyRoot: "Onoma etymology root kept with the tombstoned User's language pack data.",
  GrammarProfile: "Onoma grammar profile kept with the tombstoned User's language pack data.",
  WritingSystem: "Onoma writing system kept with the tombstoned User's language pack data.",
  LoanwordContact: "Onoma loanword contact kept with the tombstoned User's language pack data.",

  // Financial, Exchange and Vault ledgers / holdings on the tombstoned User
  Company: "Exchange company (founderId) kept on the tombstoned User so other players' shareholdings stay intact.",
  ExchangeWallet: "Exchange wallet ledger attached to the tombstoned User.",
  Shareholding: "Exchange shareholding record on the tombstoned User.",
  SectorPosition: "Exchange sector position record on the tombstoned User.",
  BondHolding: "Exchange bond holding record on the tombstoned User.",
  ConversionLog: "Exchange/credit conversion ledger record.",
  MyVault: "Vault balance record on the tombstoned User.",
  AuctionBid: "Card auction bid record kept so settled and active auction histories remain intact.",
  CardCollection: "Card collection record on the tombstoned User.",
  CardOwnership: "Card copy record on the tombstoned User (open market items close via account-erasure.market.ts).",
  UserPack: "Card pack inventory record on the tombstoned User.",
  NSImportLedger: "NationStates card import ledger preventing duplicate minting.",
  CardDustBalance: "Card dust balance record on the tombstoned User.",
  CardDustEvent: "Card dust ledger event.",
  ForumActionReward: "Forum reward payout ledger preventing duplicate credit grants.",

  // Shared Record (Privacy 5.2(3)), admin/world templates, sports history, and non-user entity ids
  CabinetMeeting: "Nation cabinet meeting record; part of the nation's Shared Record (Privacy 5.2(3)).",
  Policy: "Nation policy record; part of the nation's Shared Record (Privacy 5.2(3)).",
  ActivitySchedule: "Nation schedule record; part of the nation's Shared Record (Privacy 5.2(3)).",
  HeraldryAchievement: "Heraldic achievement (ownerId is the owning country/entity id, not a user).",
  DiplomaticScenario: "Shared diplomatic scenario template (createdBy).",
  ForeignPolicyAction: "Country-to-country diplomatic action (initiatorId is a country id).",
  MilitaryConflict: "Military conflict record (initiatorId is a country id).",
  NationalIssueTemplate: "Shared national issue template (authorId).",
  WorldEvent: "Shared world simulation event (createdBy).",
  EventChain: "Shared world simulation event chain (createdBy).",
  StorytellerEffect: "Simulation storyteller effect (createdBy).",
  EconomicArchetype: "System/admin economic archetype template (createdBy).",
  WorldPresetVersion: "World Studio preset version (createdBy).",
  MapImport: "Admin/realm map import job record (createdBy).",
  SportTeam: "Sports league team record; part of league simulation history.",
  SportPrediction: "Sports match prediction record; part of settled prediction history.",

  // Exchange: financial and governance records on the tombstoned User id; none holds personal free text.
  // Open orders and listings are NOT cancelled by erasure (only the cards market is, in account-erasure.market.ts):
  // each keeps its escrow or shares on the tombstoned User id until it fills, is cancelled by staff, or its
  // company dissolves (returnBuyOrders). Cancelling them on erasure is a follow-up, not a decision to keep them.
  ShareListing: "Exchange share listing (sellerUserId); open ones stay on the tombstoned User id until filled or cancelled, financial record.",
  ShareBuyOrder: "Exchange share buy order (buyerUserId); open ones keep their escrow on the tombstoned User id until filled or the company dissolves.",
  BondListing: "Exchange bond listing (sellerUserId); financial ledger row on the tombstoned User id, no personal text.",
  NationBond: "Exchange nation bond (issuerUserId); financial instrument other players hold, issuer id is the tombstoned User id.",
  CompanyDividend: "Exchange dividend payout ledger (declaredByUserId); financial ledger, rows reference the tombstoned User id, no personal text.",
  CompanyProposal: "Exchange governance proposal (proposerUserId); its payload is structured action data, and holders' votes already count it.",
  CompanyVote: "Exchange share-weighted vote already folded into the proposal's sharesFor/sharesAgainst; deleting the row would not undo the tally and would let an open proposal be re-voted. Holds only the tombstoned User id.",
  NationTreasury: "Nation treasury; fundUserId is the nation fund's synthetic account id (fundUserIdOf), not a person.",

  // Card ledgers, rights-holder takedowns and staff-run jobs
  CardTransferEvent: "Card copy transfer ledger (fromUserId, toUserId); rows reference the tombstoned User id, no personal text.",
  CardTakedown: "Rights-holder takedown case (requestedBy); a legal record kept under Privacy 5.2(5) like moderation cases.",
  CardImportJob: "Staff-run card import job (requestedBy is the staff member who started it); operational log, no user content.",

  // Maps, realms and sports: staff jobs, a shared record, dead ids and non-user ids
  MapImportJob: "Realm staff map import job (requestedBy is the staff member who ran it); operational log, map data belongs to the realm.",
  SvgUpload: "Staff map layer SVG upload (uploadedBy is the admin who ran it); operational record of the shared map.",
  RealmEmbassy: "Realm-to-realm embassy (proposedBy, respondedBy); part of the realms' Shared Record (Privacy 5.2(3)), and the Clerk id no longer resolves once the User row is tombstoned.",
  NationMaterialHold: "Hold on a released nation's material (formerOwnerUserId); written by releaseNationsForErasure with purgeAfter now, purged at once by the material cron.",
  AllianceAction: "Alliance action (proposedBy is a country id, not a user).",
  SportLeague: "Sports league (createdByUserId); part of the shared league simulation history, like SportTeam.",
  SportTransferBid: "Sports transfer bid (bidderUserId); part of the settled league transfer history, no personal text.",
};

const delegateOf = (model: string) => model[0]!.toLowerCase() + model.slice(1);

/**
 * A model is covered only by a real call on the transaction or client (`tx.<delegate>.`, or `db.<delegate>.` in the
 * modules that take the client, such as the market and realm steps), never by a comment or a bare mention.
 */
const isSwept = (source: string, model: string) =>
  new RegExp(`\\b(?:tx|db)\\.${delegateOf(model)}\\.`).test(source);

function userLinkedModels(): Array<{ model: string; file: string; fields: string[] }> {
  const out: Array<{ model: string; file: string; fields: string[] }> = [];
  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".prisma")).sort()) {
    const text = readFileSync(join(SCHEMA_DIR, file), "utf8");
    for (const match of text.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const model = match[1]!;
      const body = match[2]!;
      const fields = body
        .split("\n")
        .map((line) => line.match(STRING_FIELD_RE)?.[1])
        .filter((f): f is string => f !== undefined && isUserColumn(f));
      if (fields.length > 0) out.push({ model, file, fields });
    }
  }
  return out;
}

describe("account erasure schema coverage", () => {
  const erasureSource = ERASURE_FILES.map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
  const models = userLinkedModels();

  it("covers every user-linked Prisma model in the erasure modules or the explicit KEPT map", () => {
    const unhandled = models
      .filter(({ model }) => {
        const coveredInCode = isSwept(erasureSource, model);
        const keptReason = KEPT[model];
        return !coveredInCode && (!keptReason || keptReason.trim().length === 0);
      })
      .map(({ model, file, fields }) => `${model} (${file}: ${fields.join(", ")})`);

    expect(unhandled).toEqual([]);
  });

  it("keeps no stale or already-erased models in KEPT", () => {
    const modelNames = new Set(models.map((m) => m.model));
    const unknown = Object.keys(KEPT).filter((model) => !modelNames.has(model));
    const redundant = Object.keys(KEPT).filter((model) => isSwept(erasureSource, model));
    expect(unknown).toEqual([]);
    expect(redundant).toEqual([]);
  });
});
