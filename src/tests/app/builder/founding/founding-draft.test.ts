/**
 * The founding draft's rules: step gating and the prerequisite redirect, the archetype switch
 * (identity survives), reading stored drafts, the payload (never the explicit regime's
 * payloads), policy presets replacing the component set, and the wiki import's mapping and
 * archetype suggestion.
 */
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
import {
  applyImport,
  applyStart,
  emptyFoundingDraft,
  parseFoundingDraft,
  pickNewerDraft,
  startNeedsConfirm,
  toggleComponent,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";
import { readInfobox } from "~/app/builder/_founding/lib/founding-import";

function namedDraft(): FoundingDraft {
  const draft = applyStart(emptyFoundingDraft(), "nordic");
  return { ...draft, identity: { ...draft.identity, name: "Valoria", capitalCity: "Port Val" } };
}

describe("starting points", () => {
  it("asks before switching archetype, and the switch keeps identity", () => {
    const draft = namedDraft();
    expect(startNeedsConfirm(draft, "nordic")).toBe(false);
    expect(startNeedsConfirm(draft, "soviet-command")).toBe(true);
    expect(startNeedsConfirm(draft, null)).toBe(true);
    expect(startNeedsConfirm(emptyFoundingDraft(), "nordic")).toBe(false);

    const customised = {
      ...draft,
      government: toggleComponent(draft.government, "SURVEILLANCE_SYSTEM"),
    };
    const switched = applyStart(customised, "soviet-command");
    expect(switched.identity).toEqual(draft.identity);
    expect(switched.government.components).toBeNull();
    expect(switched.government.formId).toBe(
      getArchetypeDisplay("soviet-command")!.startingGovernmentForm
    );
  });
});

describe("stored drafts", () => {
  it("reads only founding drafts and repairs broken fields", () => {
    expect(parseFoundingDraft({ step: 2, economicInputs: {} })).toBeNull();
    const parsed = parseFoundingDraft({
      kind: "founding",
      version: 1,
      step: "economy",
      identity: { name: "Valoria", motto: 42 },
      start: { selection: "not-an-archetype", applied: true, archetypeKey: "nordic" },
      economy: { populationBand: "huge", exactPopulation: -5 },
    })!;
    expect(parsed.step).toBe("economy");
    expect(parsed.identity.name).toBe("Valoria");
    expect(parsed.identity.motto).toBe("");
    expect(parsed.start).toEqual({ selection: null, applied: true, archetypeKey: "nordic" });
    expect(parsed.economy.populationBand).toBeNull();
    expect(parsed.economy.exactPopulation).toBeNull();
  });

  it("lets the local crash copy win only when it is newer", () => {
    const server = { ...namedDraft(), updatedAt: 200 };
    const local = { ...namedDraft(), updatedAt: 100 };
    expect(pickNewerDraft(server, local)).toBe(server);
    expect(pickNewerDraft(server, { ...local, updatedAt: 300 })!.updatedAt).toBe(300);
    expect(pickNewerDraft(null, local)).toBe(local);
  });
});
describe("wiki import", () => {
  const infobox = {
    name: "Valoria",
    common_name: "[[Valoria]]",
    flagUrl: "https://iiwiki.com/images/flag.png",
    capital: "[[Port Val]]",
    population: "12.5 million",
    GDP_nominal_per_capita: "$61,000",
    government_type: "[[Federal republic|Federal]] parliamentary constitutional monarchy",
    official_languages: "Valorian",
    currency: "Valorian crown",
    motto: "''Onward''",
  };
  it("keeps only the ticked fields and suggests the closest archetype", () => {
    const nation = readInfobox(infobox, "iiwiki", "Valoria");
    const draft = applyImport(
      emptyFoundingDraft(),
      nation,
      new Set(["name", "gdpPerCapita", "government", "population"])
    );
    expect(draft.identity.name).toBe("Valoria");
    expect(draft.identity.capitalCity).toBe("");
    expect(draft.imported).toMatchObject({
      title: "Valoria",
      governmentRaw: "Federal parliamentary constitutional monarchy",
      formId: "constitutional-monarchy",
      population: 12_500_000,
      gdpPerCapita: 61_000,
    });
    // Very wealthy and a constitutional monarchy: the Nordic model.
    expect(draft.imported?.suggestedArchetype).toBe("nordic");
    expect(draft.start.selection).toBe("nordic");

    // The first start keeps the imported size, wealth and form over the archetype's.
    const started = applyStart(draft, "nordic");
    expect(started.economy.exactPopulation).toBe(12_500_000);
    expect(started.economy.exactGdpPerCapita).toBe(61_000);
    expect(started.government.formId).toBe("constitutional-monarchy");
  });
});
