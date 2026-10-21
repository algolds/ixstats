/** @jest-environment node */
/**
 * A signed-in player with no nation builds a founding draft for the Nordic archetype, named Valoria, previews it and
 * founds it. The payload carries no explicit tax, government or economy payload (the server builds them). The nation
 * is written with its baseline date and last calculation from one IxTime value, with the figures the preview showed,
 * the form's government and its institutions; the founder now acts as it. Its first steps are all open and the welcome
 * page names it. A customised draft sends its components and exact figures.
 *
 * Replaces the deleted country-baseline-ixtime source grep with the behaviour, and folds the payload cases of
 * founding-draft (no explicit payloads, components only once customised, exact figures in coreIndicators, the preview
 * carrying the founding's figure fields) and the new-nation and welcome cases of mycountry-first-steps.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { User: { onCountryLink: jest.fn(async () => undefined) } },
}));
jest.mock("~/lib/vault/vault-bonus", () => ({ grantBonus: jest.fn(async () => undefined) }));

import type { EconomicArchetype } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  applyStart,
  emptyFoundingDraft,
  toggleComponent,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";
import { createInput, previewInput } from "~/app/builder/_founding/lib/founding-payload";
import { buildArchetypeSeedRows } from "~/lib/economy/archetypes/seed";
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
import { departmentsForForm } from "~/lib/government/form-departments";
import { getGovernmentForm } from "~/lib/government/forms";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { myCountryFirstStepsRouter } from "~/server/api/routers/mycountry/first-steps";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, asOwner } from "~/tests/helpers/nation-world";

const countries = createCallerFactory(createTRPCRouter(managementCreateProcedures));
const firstSteps = createCallerFactory(myCountryFirstStepsRouter);

const NOW = Date.UTC(2043, 3, 1);

let db: MemoryPrisma;

/** The Nordic draft a player fills in: name and capital, the archetype's typical bands and form. */
function valoria(): FoundingDraft {
  const draft = applyStart(emptyFoundingDraft(), "nordic");
  return { ...draft, identity: { ...draft.identity, name: "Valoria", capitalCity: "Port Val" } };
}

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  IxTime.setTimeOverride(NOW);
  IxTime.setMultiplierOverride(0);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  const nordic = buildArchetypeSeedRows().find((r) => r.key === "nordic")!;
  await db.economicArchetype.create({
    data: { ...(nordic as unknown as EconomicArchetype), id: "arch_nordic" } as never,
  });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("founds Valoria from the draft at one IxTime value, with the previewed figures, then opens its first steps", async () => {
  const founder = await db.user.create({
    data: { id: "ines", clerkUserId: "ines-clerk", lastSeenAt: new Date() },
  });
  const ctx = asOwner(db as never, {
    id: founder.id,
    clerkUserId: founder.clerkUserId,
    countryId: null,
  });
  const draft = valoria();
  const form = getArchetypeDisplay("nordic")!.startingGovernmentForm;

  // What the flow sends: no explicit payloads, the form's own institutions, and the preview's figure fields
  const input = createInput(draft, "default");
  expect(input).not.toHaveProperty("taxSystemData");
  expect(input).not.toHaveProperty("governmentStructure");
  expect(input).not.toHaveProperty("economyBuilderState");
  expect(input).toMatchObject({
    name: "Valoria",
    realmId: "default",
    archetypeId: "nordic",
    governmentFormId: form,
    governmentComponents: undefined,
    economicInputs: { nationalIdentity: { countryName: "Valoria", capitalCity: "Port Val" } },
  });
  const {
    name: _name,
    realmId: _realm,
    institutionNames: _names,
    economicInputs,
    ...figures
  } = input;
  const { economicInputs: previewEcon, ...previewFigures } = previewInput(draft);
  expect(previewFigures).toEqual(figures);
  expect(previewEcon?.coreIndicators).toEqual(economicInputs?.coreIndicators);

  // The preview writes nothing; the founding writes what it showed
  const preview = await countries(ctx).previewFounding(previewInput(draft));
  expect(await db.country.count()).toBe(0);
  const country = await countries(ctx).createCountry(input);

  const written = await db.country.findUniqueOrThrow({ where: { id: country.id } });
  expect(written.baselineDate).toEqual(new Date(NOW));
  expect(written.lastCalculated).toEqual(written.baselineDate);
  expect(written).toMatchObject({
    name: "Valoria",
    realmId: "default",
    ownerUserId: "ines",
    currentPopulation: preview.population,
    currentGdpPerCapita: preview.gdpPerCapita,
    nominalGDP: preview.gdp,
  });
  expect((await db.user.findUniqueOrThrow({ where: { id: "ines" } })).countryId).toBe(country.id);

  // The form's government: its type, its departments and its components, at the previewed effectiveness
  const structure = await db.governmentStructure.findUniqueOrThrow({
    where: { countryId: country.id },
    include: { departments: true },
  });
  expect(structure.governmentType).toBe(getGovernmentForm(form)!.governmentType);
  expect(structure.departments.map((d) => d.name).sort()).toEqual(
    departmentsForForm(form)
      .map((d) => d.name)
      .sort()
  );
  expect(structure.governmentEffectiveness).toBeCloseTo(preview.governmentEffectiveness, 2);
  const components = await db.governmentComponent.findMany({ where: { countryId: country.id } });
  expect(components.map((c) => c.componentType).sort()).toEqual(
    [...getGovernmentForm(form)!.components].sort()
  );
  expect(
    (await db.nationalIdentity.findUniqueOrThrow({ where: { countryId: country.id } })).capitalCity
  ).toBe("Port Val");

  // A new nation: every first step open, and the welcome page names it
  const acting = asOwner(db as never, {
    id: "ines",
    clerkUserId: "ines-clerk",
    countryId: country.id,
  });
  const steps = await firstSteps(acting).getFirstSteps();
  expect(steps).toMatchObject({ countryId: country.id, dismissed: false, recent: true });
  expect(steps!.items.map((i) => [i.id, i.done])).toEqual([
    ["budget", false],
    ["tax", false],
    ["cabinet", false],
    ["wiki", false],
    ["capital", false],
  ]);
  expect(await firstSteps(acting).getWelcome()).toMatchObject({
    id: country.id,
    name: "Valoria",
    realmName: "Ixnay",
    population: preview.population,
  });
});

it("sends a customised draft's components and exact figures", () => {
  const draft = valoria();
  const custom: FoundingDraft = {
    ...draft,
    government: toggleComponent(draft.government, "SURVEILLANCE_SYSTEM"),
    identity: { ...draft.identity, nationalAnimal: "Lynx" },
    economy: { ...draft.economy, exactPopulation: 8_400_000 },
  };
  const input = createInput(custom, undefined);
  expect(input.governmentComponents?.map((c) => c.componentType)).toContain("SURVEILLANCE_SYSTEM");
  expect(input.economicInputs?.coreIndicators).toEqual({
    totalPopulation: 8_400_000,
    gdpPerCapita: 0,
    nominalGDP: 0,
  });
  expect(input.economicInputs?.nationalIdentity).toMatchObject({ nationalAnimal: "Lynx" });
});
