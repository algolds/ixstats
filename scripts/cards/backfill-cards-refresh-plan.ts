// scripts/cards/backfill-cards-refresh-plan.ts
/**
 * The cards refresh backfill's plan (docs/specs/2026-10-15-cards-refresh-design.md §5.5 step 3). From a snapshot of
 * the pre-refresh tables it computes, in the spec's order, every write the backfill makes, and the dry-run report.
 * Pure: backfill-cards-refresh.ts loads the snapshot and applies the plan with raw SQL in one transaction. Only
 * differences are planned, so a backfilled snapshot plans nothing: the backfill is idempotent.
 */
import type { Prisma } from "@prisma/client";
import { COMMEMORATIVE_CARD_DEFINITIONS } from "~/lib/achievements/card-rewards";
import { CardFinish, CardType, type CardRarity } from "~/lib/cards/enums";
import {
  boundFor,
  canonicalArticleTitle,
  categoryFor,
  COMMONS_LEGACY_TYPE,
  earliestRealmByArticle,
  finishFor,
  homeRealmFor,
  inferImportLedger,
  ledgerKey,
  legacyNsFacts,
  loreMergeGroups,
  mapCardType,
  mapRarity,
  mapTypeString,
  renumberCollisions,
  renumberOnto,
  SYSTEM_REALMS,
  wikiSourceKey,
  withoutStatKeys,
  type HomeRealmLookups,
  type LedgerRow,
} from "~/lib/cards/legacy-mapping";
import { nsBankValue, nsNationKey, withNsFacts } from "~/lib/cards/ns-facts";
import { DEFAULT_REALM_ID, IXNAY_SLUG } from "~/lib/realms/realm-ids";
import type {
  BackfillIo,
  BackfillPlan,
  BackfillReport,
  BackfillSnapshot,
  BackfillWriter,
  CardMerge,
  CardPatch,
  CopyPatch,
  Json,
  PackPatch,
  PackPool,
  PlanOptions,
  PlanResult,
  RealmInsert,
  SnapshotCard,
  SnapshotCopy,
  SnapshotPack,
} from "./backfill-cards-refresh-types";

interface MappedCard {
  type: CardType;
  rarity: CardRarity;
  retiredTopTier: boolean;
}

interface TargetCard {
  id: string;
  cardType: CardType;
  rarity: CardRarity;
  realmId: string;
  category: string | null;
  isBound: boolean;
  metadata: Json;
  artwork: string | null;
  wikiArticleTitle: string | null;
  wikiSource: string | null;
  createdAt: Date;
}

interface Target {
  card: SnapshotCard;
  target: TargetCard;
}

const ACHIEVEMENT_CARD_IDS: ReadonlySet<string> = new Set(
  COMMEMORATIVE_CARD_DEFINITIONS.map((definition) => definition.id)
);
const KNOWN_WIKIS: ReadonlySet<string> = new Set(["ixwiki", "iiwiki", "althistory"]);
const IXNAY_REALM: RealmInsert = {
  id: DEFAULT_REALM_ID,
  slug: IXNAY_SLUG,
  name: "Ixnay",
  description: "",
  isSystem: false,
};
/** Pack pools never hold Special or Trophy cards (pack-service.ts `packPoolWhere`). */
const OUTSIDE_POOLS: ReadonlySet<string> = new Set([CardType.SPECIAL, CardType.TROPHY]);
const SAMPLE = 50;

const isJsonObject = (value: Json | undefined): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON as text with sorted keys: jsonb reorders keys, so plain JSON.stringify would never compare equal. */
function stableJson(value: Json | undefined): string {
  if (value === null || value === undefined || typeof value !== "object")
    return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

const sameJson = (a: Json | undefined, b: Json | undefined) => stableJson(a) === stableJson(b);

const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

function emptyReport(): BackfillReport {
  return {
    realmsSeeded: [],
    typeChanges: {},
    rarityChanges: {},
    realmAssignments: {},
    commonsCards: [],
    categories: [],
    packCardTypes: [],
    packPools: [],
    suggestedRarities: [],
    otherWikiSources: [],
    holoCopies: 0,
    serialisedCopies: 0,
    nsTermCards: { count: 0, sample: [] },
    ledgerRows: 0,
    unattributedImports: 0,
    ownerInferredImports: 0,
    mergeGroups: [],
    serialRenumbers: [],
    requestCategoriesCleared: 0,
    artworkCopied: 0,
    multiQuantityCopies: 0,
  };
}

const emptyPlan = (): BackfillPlan => ({
  realms: [],
  cards: [],
  packs: [],
  copies: [],
  ledger: [],
  clearRequestCategories: false,
  merges: [],
});

export function isEmptyPlan(plan: BackfillPlan): boolean {
  const rows =
    plan.realms.length +
    plan.cards.length +
    plan.packs.length +
    plan.copies.length +
    plan.ledger.length +
    plan.merges.length;
  return rows === 0 && !plan.clearRequestCategories;
}

/** Step 1: Ixnay when missing (a fresh database), then the system realms. */
function planRealms(
  snapshot: BackfillSnapshot,
  report: BackfillReport,
  errors: string[]
): RealmInsert[] {
  const byId = new Map(snapshot.realms.map((realm) => [realm.id, realm]));
  const slugs = new Map(snapshot.realms.map((realm) => [realm.slug, realm.id]));
  const inserts: RealmInsert[] = byId.has(DEFAULT_REALM_ID) ? [] : [IXNAY_REALM];
  for (const realm of SYSTEM_REALMS) {
    const found = byId.get(realm.id);
    const slugOwner = slugs.get(realm.slug);
    if (found && !found.isSystem)
      errors.push(`Realm id "${realm.id}" belongs to a realm that is not a system realm.`);
    else if (!found && slugOwner)
      errors.push(`Realm slug "${realm.slug}" is taken by realm ${slugOwner}.`);
    else if (!found) inserts.push({ ...realm, isSystem: true });
  }
  report.realmsSeeded = inserts.map((realm) => realm.id);
  return inserts;
}

/** Adds a card id under a key (an unknown value, a missing realm, an article key), in place. */
function collect(groups: Map<string, string[]>, key: string, id: string) {
  const ids = groups.get(key);
  if (ids) ids.push(id);
  else groups.set(key, [id]);
}

const sampleIds = (ids: string[]) => `${ids.length} card(s): ${ids.slice(0, SAMPLE).join(", ")}`;

/** Step 2: every card's type and rarity; unknown values become errors naming the cards. */
function mapCards(
  snapshot: BackfillSnapshot,
  report: BackfillReport,
  errors: string[]
): Map<string, MappedCard> {
  const mapped = new Map<string, MappedCard>();
  const unknownTypes = new Map<string, string[]>();
  const unknownRarities = new Map<string, string[]>();
  const categories = new Set<string>();
  for (const card of snapshot.cards) {
    const type = mapCardType(card);
    const rarity = mapRarity(card.rarity);
    if (!type) collect(unknownTypes, card.cardType, card.id);
    if (!rarity) collect(unknownRarities, card.rarity, card.id);
    if (card.category) categories.add(card.category);
    if (card.cardType === COMMONS_LEGACY_TYPE)
      report.commonsCards.push({ id: card.id, title: card.title });
    if (!type || !rarity) continue;
    mapped.set(card.id, { type, rarity: rarity.rarity, retiredTopTier: rarity.retiredTopTier });
    if (card.cardType !== type) bump(report.typeChanges, `${card.cardType} → ${type}`);
    if (card.rarity !== rarity.rarity)
      bump(report.rarityChanges, `${card.rarity} → ${rarity.rarity}`);
  }
  for (const [value, ids] of unknownTypes)
    errors.push(`Unknown cardType "${value}" on ${sampleIds(ids)}`);
  for (const [value, ids] of unknownRarities)
    errors.push(`Unknown rarity "${value}" on ${sampleIds(ids)}`);
  report.categories = [...categories].sort();
  return mapped;
}

/** A theme filter's `cardTypes` as pack-service reads it: a list, or one type as a string; null when unset. */
function themeTypeList(theme: Prisma.JsonObject): Prisma.JsonValue[] | null {
  const raw = theme.cardTypes;
  if (typeof raw === "string") return [raw];
  return Array.isArray(raw) ? raw : null;
}

/** A theme filter whose `cardTypes` named retired types, remapped (keeping its shape); undefined when nothing changes. */
function remapThemeTypes(theme: Json, packId: string, errors: string[]): Json | undefined {
  const list = isJsonObject(theme) ? themeTypeList(theme) : null;
  if (!isJsonObject(theme) || !list) return undefined;
  const types = list.map((value) => (typeof value === "string" ? mapTypeString(value) : null));
  if (types.some((type) => type === null)) {
    errors.push(
      `Unknown themeFilter.cardTypes on pack ${packId}: ${JSON.stringify(theme.cardTypes)}`
    );
    return undefined;
  }
  const unique = [...new Set(types.filter((type): type is CardType => type !== null))];
  const next = typeof theme.cardTypes === "string" ? (unique[0] ?? theme.cardTypes) : unique;
  return sameJson(next, theme.cardTypes) ? undefined : { ...theme, cardTypes: next };
}

function packPatch(pack: SnapshotPack, errors: string[]): PackPatch | null {
  const patch: PackPatch = { id: pack.id };
  const type = pack.cardType === null ? null : mapTypeString(pack.cardType);
  if (pack.cardType !== null && !type)
    errors.push(`Unknown cardType "${pack.cardType}" on pack ${pack.id}`);
  if (type && type !== pack.cardType) patch.cardType = type;
  const rarity = pack.guaranteedRarity === null ? null : mapRarity(pack.guaranteedRarity);
  if (pack.guaranteedRarity !== null && !rarity)
    errors.push(`Unknown guaranteedRarity "${pack.guaranteedRarity}" on pack ${pack.id}`);
  if (rarity && rarity.rarity !== pack.guaranteedRarity) patch.guaranteedRarity = rarity.rarity;
  const theme = remapThemeTypes(pack.themeFilter, pack.id, errors);
  if (theme !== undefined) patch.themeFilter = theme;
  return Object.keys(patch).length > 1 ? patch : null;
}

/** Step 2 for packs: their type, theme types and guaranteed rarity, with the same tables as cards. */
function planPacks(
  snapshot: BackfillSnapshot,
  report: BackfillReport,
  errors: string[]
): PackPatch[] {
  report.packCardTypes = [
    ...new Set(snapshot.packs.flatMap((pack) => (pack.cardType ? [pack.cardType] : []))),
  ].sort();
  return snapshot.packs.flatMap((pack) => packPatch(pack, errors) ?? []);
}

function noteNsTerm(
  card: SnapshotCard,
  target: TargetCard,
  report: BackfillReport,
  options: PlanOptions
) {
  const bankValue = nsBankValue(target.metadata);
  const floor = options.floor(target.rarity);
  if (bankValue === null || bankValue * options.nsPremium <= floor) return;
  report.nsTermCards.count += 1;
  if (report.nsTermCards.sample.length < SAMPLE)
    report.nsTermCards.sample.push({ id: card.id, title: card.title, bankValue, floor });
}

/** Steps 3, 5, 6 and 10 for one card, plus its canonical article title. */
function targetCard(card: SnapshotCard, mapped: MappedCard, lookups: HomeRealmLookups): TargetCard {
  const isArticle = mapped.type === CardType.LORE || mapped.type === CardType.TROPHY;
  const wikiArticleTitle =
    isArticle && card.wikiArticleTitle
      ? canonicalArticleTitle(card.wikiArticleTitle, card.wikiSource)
      : card.wikiArticleTitle;
  const realmId =
    card.realmId ??
    homeRealmFor(
      {
        type: mapped.type,
        countryId: card.countryId,
        wikiSource: card.wikiSource,
        wikiArticleTitle,
        title: card.title,
      },
      lookups
    );
  const metadata =
    mapped.type === CardType.NS
      ? withNsFacts(withoutStatKeys(card.metadata), legacyNsFacts(card))
      : withoutStatKeys(card.metadata);
  return {
    id: card.id,
    cardType: mapped.type,
    rarity: mapped.rarity,
    realmId,
    category: categoryFor({ type: mapped.type, category: card.category }),
    isBound: boundFor(
      { id: card.id, type: mapped.type, isBound: card.isBound },
      ACHIEVEMENT_CARD_IDS
    ),
    metadata,
    artwork: card.artwork?.trim() ? card.artwork : card.artworkUrl?.trim() || card.artwork,
    wikiArticleTitle,
    wikiSource: card.wikiSource,
    createdAt: card.createdAt,
  };
}

function cardPatch(before: SnapshotCard, after: TargetCard): CardPatch | null {
  const patch: CardPatch = { id: before.id };
  if (before.cardType !== after.cardType) patch.cardType = after.cardType;
  if (before.rarity !== after.rarity) patch.rarity = after.rarity;
  if (before.realmId !== after.realmId) patch.realmId = after.realmId;
  if (before.category !== after.category) patch.category = after.category;
  if (before.isBound !== after.isBound) patch.isBound = after.isBound;
  if (!sameJson(before.metadata, after.metadata)) patch.metadata = after.metadata;
  if (after.artwork !== null && before.artwork !== after.artwork) patch.artwork = after.artwork;
  if (after.wikiArticleTitle !== null && before.wikiArticleTitle !== after.wikiArticleTitle)
    patch.wikiArticleTitle = after.wikiArticleTitle;
  return Object.keys(patch).length > 1 ? patch : null;
}

function noteCard(
  card: SnapshotCard,
  target: TargetCard,
  report: BackfillReport,
  options: PlanOptions
) {
  if (card.realmId === null) bump(report.realmAssignments, target.realmId);
  if (card.artwork !== target.artwork) report.artworkCopied += 1;
  if (target.cardType === CardType.NS) noteNsTerm(card, target, report, options);
  const wiki = wikiSourceKey(card.wikiSource);
  const isArticle = target.cardType === CardType.LORE || target.cardType === CardType.TROPHY;
  if (isArticle && !KNOWN_WIKIS.has(wiki) && !report.otherWikiSources.includes(wiki))
    report.otherWikiSources.push(wiki);
}

/** Every mapped card's target. planBackfill stops before this whenever a card failed to map, so none is skipped. */
function planTargets(
  snapshot: BackfillSnapshot,
  mapped: ReadonlyMap<string, MappedCard>,
  report: BackfillReport,
  options: PlanOptions
): Target[] {
  const lookups: HomeRealmLookups = {
    countryRealm: new Map(snapshot.countries.map((country) => [country.id, country.realmId])),
    articleRealm: earliestRealmByArticle(snapshot.realmPages),
  };
  return snapshot.cards.flatMap((card) => {
    const mappedCard = mapped.get(card.id);
    if (!mappedCard) return [];
    const target = targetCard(card, mappedCard, lookups);
    noteCard(card, target, report, options);
    return [{ card, target }];
  });
}

/** Cards whose realm exists neither now nor in the plan's inserts: the constraints' foreign key would refuse them. */
function orphanErrors(targets: readonly Target[], realmIds: ReadonlySet<string>): string[] {
  const orphans = new Map<string, string[]>();
  for (const { target } of targets) {
    if (!realmIds.has(target.realmId)) collect(orphans, target.realmId, target.id);
  }
  return [...orphans].map(
    ([realmId, ids]) => `Realm "${realmId}" does not exist, yet ${sampleIds(ids)} point at it`
  );
}

/**
 * Copies held as `quantity > 1` (a re-awarded achievement card, the retired duplicate merge): the constraint SQL drops
 * `quantity` and refuses while any remain, so the dry run fails on them too. The backfill never splits them; the owner
 * resolves each row first.
 */
function quantityErrors(count: number): string[] {
  if (count === 0) return [];
  return [
    `${count} copies hold quantity > 1, and the constraint SQL drops quantity: resolve those rows first ` +
      `(SELECT id, "cardId", "ownerId", quantity FROM "CardOwnership" WHERE quantity > 1)`,
  ];
}

/**
 * Lore cards the constraints' natural key, `(COALESCE(wikiSource, 'ixwiki'), lower(wikiArticleTitle))`, would still
 * refuse after the merges: say, two blank titles, which are never merged. Caught here, before the window, not there.
 */
function naturalKeyErrors(targets: readonly Target[], losers: ReadonlySet<string>): string[] {
  const byKey = new Map<string, string[]>();
  for (const { target } of targets) {
    if (
      target.cardType !== CardType.LORE ||
      target.wikiArticleTitle === null ||
      losers.has(target.id)
    )
      continue;
    collect(
      byKey,
      `${target.wikiSource ?? "ixwiki"}:${target.wikiArticleTitle.toLowerCase()}`,
      target.id
    );
  }
  return [...byKey]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => `Lore article "${key}" would keep ${sampleIds(ids)} after the merges`);
}

/** Step 4: finishes (trophies Serialised, retired top tiers Holo). */
function targetCopies(
  snapshot: BackfillSnapshot,
  mapped: ReadonlyMap<string, MappedCard>,
  report: BackfillReport
): SnapshotCopy[] {
  return snapshot.copies.map((copy) => {
    const card = mapped.get(copy.cardId);
    const finish = card
      ? finishFor({ type: card.type, retiredTopTier: card.retiredTopTier, current: copy.finish })
      : copy.finish;
    if (finish !== copy.finish && finish === CardFinish.HOLO) report.holoCopies += 1;
    if (finish !== copy.finish && finish === CardFinish.SERIALISED) report.serialisedCopies += 1;
    return { ...copy, finish };
  });
}

/** Step 7: the import ledger from existing NS copies. */
function planLedger(
  snapshot: BackfillSnapshot,
  mapped: ReadonlyMap<string, MappedCard>,
  report: BackfillReport
): LedgerRow[] {
  const nsCards = new Map<string, { nsCardId: number; nsSeason: number }>();
  for (const card of snapshot.cards) {
    if (
      mapped.get(card.id)?.type !== CardType.NS ||
      card.nsCardId === null ||
      card.nsSeason === null
    )
      continue;
    nsCards.set(card.id, { nsCardId: card.nsCardId, nsSeason: card.nsSeason });
  }
  const copies = snapshot.copies.flatMap((copy) => {
    const ns = nsCards.get(copy.cardId);
    return ns ? [{ ...copy, ...ns }] : [];
  });
  const verifiedNations = new Map<string, string[]>();
  for (const { userId, nationName } of snapshot.verifications) {
    const nations = verifiedNations.get(userId) ?? [];
    const key = nsNationKey(nationName);
    if (!nations.includes(key)) verifiedNations.set(userId, [...nations, key]);
  }
  const { rows, unattributed, ownerInferred } = inferImportLedger({
    copies,
    transfers: snapshot.transfers,
    verifiedNations,
    existing: new Set(snapshot.ledger.map(ledgerKey)),
  });
  report.ledgerRows = rows.length;
  report.unattributedImports = unattributed;
  report.ownerInferredImports = ownerInferred;
  return rows;
}

/** Step 8: duplicate Lore cards merged onto their survivor; moving copies numbered after its highest serial. */
function planMerges(
  cards: readonly TargetCard[],
  copies: SnapshotCopy[],
  report: BackfillReport
): CardMerge[] {
  const copyCount = new Map<string, number>();
  for (const copy of copies) copyCount.set(copy.cardId, (copyCount.get(copy.cardId) ?? 0) + 1);
  const groups = loreMergeGroups(
    cards.map((card) => ({
      id: card.id,
      type: card.cardType,
      wikiSource: card.wikiSource,
      wikiArticleTitle: card.wikiArticleTitle,
      createdAt: card.createdAt,
      copies: copyCount.get(card.id) ?? 0,
    }))
  );
  const byId = new Map(copies.map((copy) => [copy.id, copy]));
  for (const group of groups) {
    const survivorMax = Math.max(
      0,
      ...copies.filter((c) => c.cardId === group.survivorId).map((c) => c.serialNumber)
    );
    const moving = copies.filter((copy) => group.loserIds.includes(copy.cardId));
    for (const { id, serialNumber } of renumberOnto(survivorMax, moving)) {
      const copy = byId.get(id);
      if (copy) Object.assign(copy, { cardId: group.survivorId, serialNumber });
    }
    report.mergeGroups.push({ ...group, copiesMoved: moving.length });
  }
  return groups.map(({ survivorId, loserIds }) => ({ survivorId, loserIds }));
}

/** Step 9: any serial still shared within a card, renumbered by acquisition. */
function renumberRemaining(copies: SnapshotCopy[], report: BackfillReport) {
  const byCard = new Map<string, SnapshotCopy[]>();
  for (const copy of copies) {
    const group = byCard.get(copy.cardId);
    if (group) group.push(copy);
    else byCard.set(copy.cardId, [copy]);
  }
  const byId = new Map(copies.map((copy) => [copy.id, copy]));
  for (const [cardId, group] of byCard) {
    for (const { id, serialNumber } of renumberCollisions(group)) {
      const copy = byId.get(id);
      if (!copy) continue;
      report.serialRenumbers.push({
        ownershipId: id,
        cardId,
        from: copy.serialNumber,
        to: serialNumber,
      });
      copy.serialNumber = serialNumber;
    }
  }
}

function copyPatches(before: readonly SnapshotCopy[], after: readonly SnapshotCopy[]): CopyPatch[] {
  const original = new Map(before.map((copy) => [copy.id, copy]));
  return after.flatMap((copy) => {
    const was = original.get(copy.id);
    if (!was) return [];
    const patch: CopyPatch = { id: copy.id };
    if (was.cardId !== copy.cardId) patch.cardId = copy.cardId;
    if (was.serialNumber !== copy.serialNumber) patch.serialNumber = copy.serialNumber;
    if (was.finish !== copy.finish) patch.finish = copy.finish;
    return Object.keys(patch).length > 1 ? [patch] : [];
  });
}

interface PoolCard {
  type: string;
  season: number;
}

interface PoolFilter {
  cardType: string | null;
  season: number | null;
  types: string[] | null;
}

/** A theme filter's type strings, as pack-service filters by them; null when the theme names none. */
function poolThemeTypes(theme: Json): string[] | null {
  const list = isJsonObject(theme) ? themeTypeList(theme) : null;
  const types = (list ?? []).filter(
    (value): value is string => typeof value === "string" && value !== ""
  );
  return types.length > 0 ? types : null;
}

function poolSize(cards: readonly PoolCard[], filter: PoolFilter): number {
  return cards.filter(
    (card) =>
      !OUTSIDE_POOLS.has(card.type) &&
      (!filter.cardType || card.type === filter.cardType) &&
      (!filter.season || card.season === filter.season) &&
      (!filter.types || filter.types.includes(card.type))
  ).length;
}

/** The pools of the packs that filter by type, on the old strings and on the remapped types without merge losers. */
function packPools(
  snapshot: BackfillSnapshot,
  targets: readonly Target[],
  losers: ReadonlySet<string>
): PackPool[] {
  const before = snapshot.cards.map((card) => ({ type: card.cardType, season: card.season }));
  const after = targets
    .filter(({ card }) => !losers.has(card.id))
    .map(({ card, target }) => ({ type: target.cardType, season: card.season }));
  return snapshot.packs.flatMap((pack) => {
    const types = poolThemeTypes(pack.themeFilter);
    if (!pack.cardType && !types) return [];
    const cardType = pack.cardType ? mapTypeString(pack.cardType) : null;
    const afterTypes = types ? types.flatMap((type) => mapTypeString(type) ?? []) : null;
    return [
      {
        id: pack.id,
        cardType,
        season: pack.season,
        before: poolSize(before, { cardType: pack.cardType, season: pack.season, types }),
        after: poolSize(after, { cardType, season: pack.season, types: afterTypes }),
      },
    ];
  });
}

/** Every write the backfill makes, in the spec's order, and the report. Unknown values plan nothing. */
export function planBackfill(snapshot: BackfillSnapshot, options: PlanOptions): PlanResult {
  const errors: string[] = [];
  const report = emptyReport();
  const realms = planRealms(snapshot, report, errors);
  const mapped = mapCards(snapshot, report, errors);
  const packs = planPacks(snapshot, report, errors);
  report.suggestedRarities = [...new Set(snapshot.requestSuggestedRarities)].sort();
  report.requestCategoriesCleared = snapshot.requestNsImportCategories;
  report.multiQuantityCopies = snapshot.multiQuantityCopies;
  errors.push(...quantityErrors(snapshot.multiQuantityCopies));
  if (errors.length > 0) return { plan: emptyPlan(), report, errors };

  const targets = planTargets(snapshot, mapped, report, options);
  errors.push(
    ...orphanErrors(targets, new Set([...snapshot.realms, ...realms].map((realm) => realm.id)))
  );
  if (errors.length > 0) return { plan: emptyPlan(), report, errors };
  const copies = targetCopies(snapshot, mapped, report);
  const ledger = planLedger(snapshot, mapped, report);
  const merges = planMerges(
    targets.map(({ target }) => target),
    copies,
    report
  );
  renumberRemaining(copies, report);

  const losers = new Set(merges.flatMap((merge) => merge.loserIds));
  errors.push(...naturalKeyErrors(targets, losers));
  if (errors.length > 0) return { plan: emptyPlan(), report, errors };
  report.packPools = packPools(snapshot, targets, losers);
  const cards = targets.flatMap(({ card, target }) =>
    losers.has(card.id) ? [] : (cardPatch(card, target) ?? [])
  );
  return {
    plan: {
      realms,
      cards,
      packs,
      copies: copyPatches(snapshot.copies, copies),
      ledger,
      clearRequestCategories: snapshot.requestNsImportCategories > 0,
      merges,
    },
    report,
    errors,
  };
}

/**
 * Applies a plan, grouped by table: the realms before any card points at them, and copies moved to their survivors
 * before the old cards are deleted.
 */
export async function applyPlan(writer: BackfillWriter, plan: BackfillPlan): Promise<void> {
  await writer.insertRealms(plan.realms);
  await writer.updateCards(plan.cards);
  await writer.updatePacks(plan.packs);
  await writer.updateCopies(plan.copies);
  await writer.insertLedger(plan.ledger);
  if (plan.clearRequestCategories) await writer.clearRequestCategories();
  for (const merge of plan.merges) await writer.mergeCards(merge);
}

/** Plans, and with `apply` writes the plan unless the dry run found errors or there is nothing to do. */
export async function runBackfill(
  io: BackfillIo,
  apply: boolean
): Promise<PlanResult & { applied: boolean }> {
  const result = planBackfill(await io.load(), await io.options());
  if (!apply || result.errors.length > 0 || isEmptyPlan(result.plan))
    return { ...result, applied: false };
  await io.write((writer) => applyPlan(writer, result.plan));
  return { ...result, applied: true };
}
