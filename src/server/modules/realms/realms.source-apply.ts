/**
 * Executes a source sync plan (src/lib/realms/sources/plan.ts) against the database, one nation, border or
 * alliance at a time, so one bad entry is recorded and skipped instead of undoing the run.
 *
 * - New nations are unclaimed Countries (`ownerUserId` null) built with the same baseline the claim flow uses
 *   (buildBaselineCountryData), at the claim flow's free slug, with the source key, wiki page and identity.
 *   Their wiki infoboxes are read one at a time with a pause between reads (each read gives up after 8 s).
 * - Figures change through the baseline calculator too, so stored stats and tiers stay consistent.
 * - Borders go through the realm map writer (src/lib/maps/realm-map-writer.ts) as the realm's political
 *   features, keyed by realm + source key, validated, named and linked to their nation, which takes the
 *   outline, centroid and bounding box. Its land area stays the source's stated figure; the traced area is only
 *   the fallback for a nation the source gives none. Adjacency and the map caches are rebuilt afterwards.
 * - Alliances are created or updated in the realm, and listed members join as active members. Nobody is ever
 *   removed from an alliance, no nation is deleted, and no claimed nation changes hands.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import { invalidateCache } from "~/lib/cache";
import { rebuildAdjacency } from "~/lib/maps/adjacency";
import { writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import type { FieldChange, NationRef, PlannedNation, SyncPlan } from "~/lib/realms/sources/plan";
import { isEmptyInfobox, newNationFields, type InfoboxFacts } from "~/lib/realms/sources/stats";
import type { AppliedResult } from "~/lib/realms/sources/summary";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { freeNationSlug } from "./realms.claims";

export interface ApplyContext {
  realmId: string;
  realmSlug: string;
  /** The wiki the nations' page titles are on (a WikiOS source id), or null. */
  wikiSource: string | null;
  attribution: string | null;
}

export interface ApplyDeps {
  /** A nation page's infobox facts (realms.prefill fetchNationPagePrefill); never throws. */
  fetchInfobox?: (wikiSource: string, title: string) => Promise<InfoboxFacts>;
  /** Pause between two infobox reads. */
  wikiDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_WIKI_DELAY_MS = 750;

const SQKM_TO_SQMI = 0.386102;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

/** The stored stats a change of population, GDP per capita or land area gives, through the baseline calculator. */
export function statsUpdateData(
  country: { name: string; baselinePopulation: number; baselineGdpPerCapita: number; landArea: number | null; continent: string | null },
  changes: readonly FieldChange[]
) {
  const to = (field: FieldChange["field"]) => changes.find((c) => c.field === field)?.to;
  const population = to("population") as number | undefined;
  const gdpPerCapita = to("gdpPerCapita") as number | undefined;
  const landArea = to("landArea") as number | undefined;
  const continent = to("continent") as string | undefined;
  const data: Prisma.CountryUpdateInput = {};
  if (continent !== undefined) data.continent = continent;
  if (population === undefined && gdpPerCapita === undefined && landArea === undefined) return data;
  const base = buildBaselineCountryData(country.name, {
    baselinePopulation: population ?? country.baselinePopulation,
    baselineGdpPerCapita: gdpPerCapita ?? country.baselineGdpPerCapita,
    landArea: landArea ?? country.landArea ?? undefined,
    continent: continent ?? country.continent ?? undefined,
  });
  return {
    ...data,
    baselinePopulation: base.baselinePopulation,
    baselineGdpPerCapita: base.baselineGdpPerCapita,
    ...(landArea !== undefined && { landArea, areaSqMi: landArea * SQKM_TO_SQMI }),
    currentPopulation: base.currentPopulation,
    currentGdpPerCapita: base.currentGdpPerCapita,
    currentTotalGdp: base.currentTotalGdp,
    economicTier: base.economicTier,
    populationTier: base.populationTier,
    populationDensity: base.populationDensity,
    gdpDensity: base.gdpDensity,
    nominalGDP: base.nominalGDP,
    baselineDate: base.baselineDate,
    lastCalculated: base.lastCalculated,
  };
}

async function createNations(
  db: PrismaClient,
  ctx: ApplyContext,
  creates: readonly PlannedNation[],
  deps: ApplyDeps,
  result: AppliedResult
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let readBefore = false;
  for (const planned of creates) {
    try {
      let infobox: InfoboxFacts | null = null;
      if (planned.readInfobox && planned.wikiTitle && ctx.wikiSource && deps.fetchInfobox) {
        if (readBefore) await sleep(deps.wikiDelayMs ?? DEFAULT_WIKI_DELAY_MS);
        readBefore = true;
        infobox = await deps.fetchInfobox(ctx.wikiSource, planned.wikiTitle).catch(() => null);
        if (isEmptyInfobox(infobox)) result.infoboxEmpty.push(planned.name);
      }
      const { initial, identity } = newNationFields(planned, infobox);
      const slug = await freeNationSlug(db, { title: planned.name, realmSlug: ctx.realmSlug });
      const country = await db.country.create({
        data: {
          ...buildBaselineCountryData(planned.name, initial),
          slug,
          realmId: ctx.realmId,
          externalSourceKey: planned.key,
          wikiSource: planned.wikiTitle && ctx.wikiSource ? ctx.wikiSource : null,
          wikiPageTitle: planned.wikiTitle && ctx.wikiSource ? planned.wikiTitle : null,
          ...(Object.keys(identity).length > 0 && {
            nationalIdentity: { create: { countryName: planned.name, ...identity } },
          }),
        },
        select: { id: true },
      });
      ids.set(planned.name, country.id);
      result.created++;
    } catch (error) {
      result.errors.push(`Create ${planned.name}: ${message(error)}`);
    }
  }
  return ids;
}

async function updateNations(db: PrismaClient, plan: SyncPlan, result: AppliedResult): Promise<void> {
  for (const update of plan.updates) {
    try {
      const country = await db.country.findUnique({
        where: { id: update.countryId },
        select: {
          name: true,
          ownerUserId: true,
          baselinePopulation: true,
          baselineGdpPerCapita: true,
          landArea: true,
          continent: true,
        },
      });
      if (!country) continue;
      // The plan was made from a read before this write: a nation claimed since keeps its figures.
      const claimedSince = !update.claimed && country.ownerUserId !== null;
      const changes = claimedSince ? [] : update.changes;
      const identity: Record<string, string> = {};
      for (const change of changes) {
        if (change.field === "capital") identity.capitalCity = String(change.to);
        if (change.field === "officialName") identity.officialName = String(change.to);
      }
      const data: Prisma.CountryUpdateInput = {
        ...statsUpdateData(country, changes),
        ...(update.bindKey && { externalSourceKey: update.key }),
      };
      await db.$transaction(async (tx) => {
        if (Object.keys(data).length > 0)
          await tx.country.update({ where: { id: update.countryId }, data });
        if (Object.keys(identity).length > 0)
          await tx.nationalIdentity.upsert({
            where: { countryId: update.countryId },
            update: identity,
            create: { countryId: update.countryId, countryName: country.name, ...identity },
          });
      });
      if (changes.length > 0) result.updated++;
    } catch (error) {
      result.errors.push(`Update ${update.name}: ${message(error)}`);
    }
  }
}

const resolve = (ref: NationRef | null, created: ReadonlyMap<string, string>) =>
  !ref ? null : "countryId" in ref ? ref.countryId : (created.get(ref.newName) ?? null);

async function writeFeatures(
  db: PrismaClient,
  ctx: ApplyContext,
  plan: SyncPlan,
  created: ReadonlyMap<string, string>,
  result: AppliedResult
): Promise<void> {
  if (plan.features.length === 0) return;
  const linked = plan.features.map((feature) => ({ feature, countryId: resolve(feature.nation, created) }));
  const ids = linked.flatMap(({ countryId }) => (countryId ? [countryId] : []));
  const names = new Map(
    (await db.country.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map(
      (c) => [c.id, c.name]
    )
  );
  const written = await writeRealmMapFeatures(
    db,
    ctx.realmId,
    linked.map(({ feature, countryId }) => ({
      key: feature.key,
      geometry: feature.geometry,
      name: (countryId && names.get(countryId)) ?? null,
      countryId,
      areaKm2: feature.areaKm2,
      properties: {
        sourceKey: feature.key,
        sourceHash: feature.sourceHash,
        ...(ctx.attribution && { attribution: ctx.attribution }),
      },
    })),
    { layerType: "political" }
  );
  result.features += written.written.length;
  for (const { key, reason } of written.rejected) result.errors.push(`Border ${key}: ${reason}`);

  // The nation's stated land area stays its land area; only a nation the source gives none takes the source's
  // traced area (or, without one, the measured area of the written border).
  const done = new Set(written.written);
  for (const { feature, countryId } of linked) {
    if (!countryId || !feature.setLandArea || !done.has(feature.key)) continue;
    const area = feature.areaKm2 ?? written.areas[feature.key] ?? null;
    if (area === null) continue;
    await db.country
      .update({ where: { id: countryId }, data: { landArea: area, areaSqMi: area * SQKM_TO_SQMI } })
      .catch((error: unknown) => result.errors.push(`Land area ${feature.key}: ${message(error)}`));
  }
  try {
    await rebuildAdjacency(db, ctx.realmId);
  } catch (error) {
    result.errors.push(`Adjacency rebuild: ${message(error)}`);
  }
  clearLayerCache();
  await invalidateCache(["geoCore.getWorldMap", "geoCore.getMapBundle"]).catch(() => undefined);
}

async function writeAlliances(
  db: PrismaClient,
  ctx: ApplyContext,
  plan: SyncPlan,
  created: ReadonlyMap<string, string>,
  result: AppliedResult
): Promise<void> {
  for (const planned of plan.alliances) {
    try {
      const alliance = planned.allianceId
        ? await db.alliance.update({
            where: { id: planned.allianceId },
            data: {
              name: planned.name,
              externalSourceKey: planned.key,
              ...(planned.shortName && { shortName: planned.shortName.slice(0, 10) }),
              ...(planned.color && { color: planned.color }),
              ...(planned.type && { type: planned.type }),
            },
            select: { id: true, realmId: true },
          })
        : await db.alliance.create({
            data: {
              realmId: ctx.realmId,
              externalSourceKey: planned.key,
              name: planned.name,
              shortName: planned.shortName?.slice(0, 10) ?? null,
              type: planned.type ?? "political",
              ...(planned.color && { color: planned.color }),
              visibility: "public",
              joinPolicy: "invite",
            },
            select: { id: true, realmId: true },
          });
      if (alliance.realmId !== ctx.realmId) throw new Error("the alliance is in another realm");
      if (planned.allianceId) result.alliancesUpdated++;
      else result.alliancesCreated++;
      for (const member of planned.addMembers) {
        const countryId = resolve(member.nation, created);
        if (!countryId) continue;
        const country = await db.country.findUnique({ where: { id: countryId }, select: { realmId: true } });
        if (country?.realmId !== ctx.realmId) continue;
        const existing = await db.allianceMember.findUnique({
          where: { allianceId_countryId: { allianceId: alliance.id, countryId } },
          select: { id: true, isActive: true, status: true },
        });
        // A nation that left (or declined) in IxStats is not pulled back in by the source.
        if (existing) continue;
        await db.allianceMember.create({
          data: { allianceId: alliance.id, countryId, role: "member", status: "active", isActive: true },
        });
        result.membersAdded++;
      }
      const memberCount = await db.allianceMember.count({ where: { allianceId: alliance.id, isActive: true } });
      await db.alliance.update({ where: { id: alliance.id }, data: { memberCount } });
    } catch (error) {
      result.errors.push(`Alliance ${planned.name}: ${message(error)}`);
    }
  }
}

/** Write the plan. Returns what was written and every entry that failed (the rest still went through). */
export async function applySyncPlan(
  db: PrismaClient,
  ctx: ApplyContext,
  plan: SyncPlan,
  deps: ApplyDeps = {}
): Promise<AppliedResult> {
  const result: AppliedResult = {
    created: 0,
    updated: 0,
    features: 0,
    alliancesCreated: 0,
    alliancesUpdated: 0,
    membersAdded: 0,
    infoboxEmpty: [],
    errors: [],
  };
  const created = await createNations(db, ctx, plan.creates, deps, result);
  await updateNations(db, plan, result);
  await writeFeatures(db, ctx, plan, created, result);
  await writeAlliances(db, ctx, plan, created, result);
  return result;
}
