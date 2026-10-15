/**
 * The founding draft's rules: step gating and the prerequisite redirect, the archetype switch
 * (identity survives), reading stored drafts, the payload (never the explicit regime's
 * payloads), policy presets replacing the component set, and the wiki import's mapping and
 * archetype suggestion.
 */
import { getGovernmentForm } from "~/lib/government/forms";
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
import { getPolicyPreset } from "~/lib/government/policy-presets";
import {
  activeComponents,
  applyImport,
  applyPreset,
  applyStart,
  emptyFoundingDraft,
  firstIncompleteStep,
  parseFoundingDraft,
  pickNewerDraft,
  renameInstitution,
  resolveStep,
  startNeedsConfirm,
  toggleComponent,
  validateIdentity,
  visibleSteps,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";
import { suggestArchetype } from "~/app/builder/_founding/lib/founding-archetypes";
import { createInput, previewInput } from "~/app/builder/_founding/lib/founding-payload";
import { readInfobox } from "~/app/builder/_founding/lib/founding-import";
import { describeFoundingError } from "~/app/builder/_founding/lib/founding-errors";

const NO_REALMS = { creatableRealmIds: null };

function namedDraft(): FoundingDraft {
  const draft = applyStart(emptyFoundingDraft(), "nordic");
  return { ...draft, identity: { ...draft.identity, name: "Valoria", capitalCity: "Port Val" } };
}

describe("step gating", () => {
  it("shows the realm step only when the player can choose a realm", () => {
    expect(visibleSteps(false)).toEqual(["start", "identity", "government", "economy", "review"]);
    expect(visibleSteps(true)[0]).toBe("realm");
  });

  it("sends a step whose prerequisites are missing to the first incomplete step", () => {
    const steps = visibleSteps(false);
    const fresh = emptyFoundingDraft();
    expect(resolveStep(fresh, "review", steps, NO_REALMS)).toBe("start");
    const started = applyStart(fresh, "nordic");
    expect(resolveStep(started, "economy", steps, NO_REALMS)).toBe("identity");
    expect(resolveStep(namedDraft(), "economy", steps, NO_REALMS)).toBe("economy");
    expect(resolveStep(namedDraft(), "review", steps, NO_REALMS)).toBe("review");
  });

  it("falls back to the saved step for an unknown or missing request", () => {
    const steps = visibleSteps(false);
    const draft = { ...namedDraft(), step: "government" as const };
    expect(resolveStep(draft, "nonsense", steps, NO_REALMS)).toBe("government");
    expect(resolveStep(draft, null, steps, NO_REALMS)).toBe("government");
  });

  it("needs a realm with room when the realm step is shown", () => {
    const steps = visibleSteps(true);
    const draft = namedDraft();
    const context = { creatableRealmIds: ["ixnay", "other"] };
    expect(firstIncompleteStep(draft, steps, context)).toBe("realm");
    expect(firstIncompleteStep({ ...draft, realmId: "full" }, steps, context)).toBe("realm");
    expect(firstIncompleteStep({ ...draft, realmId: "other" }, steps, context)).toBe("review");
  });

  it("validates identity in words", () => {
    const errors = validateIdentity({
      ...emptyFoundingDraft().identity,
      flagUrl: "ftp://nope",
      isoCode: "TOOLONG",
    });
    expect(errors.name).toBe("Enter a name for your nation.");
    expect(errors.flagUrl).toMatch(/https/);
    expect(errors.isoCode).toMatch(/two or three letters/);
  });
});

describe("starting points", () => {
  it("applies an archetype's typical size, wealth and starting form", () => {
    const draft = applyStart(emptyFoundingDraft(), "nordic");
    const display = getArchetypeDisplay("nordic")!;
    expect(draft.start).toEqual({ selection: "nordic", applied: true, archetypeKey: "nordic" });
    expect(draft.government.formId).toBe(display.startingGovernmentForm);
    expect(draft.economy.populationBand).toBe(display.typicalPopulationBand);
    expect(draft.economy.wealthBand).toBe(display.typicalWealthBand);
  });

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

  it("a blank start leaves size and wealth to the server's defaults", () => {
    const blank = applyStart(emptyFoundingDraft(), null);
    expect(blank.start).toEqual({ selection: null, applied: true, archetypeKey: null });
    const input = previewInput(blank);
    expect(input.archetypeId).toBeUndefined();
    expect(input.populationBand).toBeUndefined();
    expect(input.wealthBand).toBeUndefined();
  });

  it("drops a component copy that matches the form's set again", () => {
    const { government } = namedDraft();
    const added = toggleComponent(government, "SURVEILLANCE_SYSTEM");
    expect(added.components).toContain("SURVEILLANCE_SYSTEM");
    expect(toggleComponent(added, "SURVEILLANCE_SYSTEM").components).toBeNull();
  });

  it("replaces the whole component set with a policy preset in one update", () => {
    const { government } = namedDraft();
    const customised = toggleComponent(government, "SURVEILLANCE_SYSTEM");
    const preset = getPolicyPreset("technocracy")!.components;
    const applied = applyPreset(customised, [...preset, preset[0]!]);
    expect(activeComponents(applied)).toEqual(preset);
    expect(applied.institutions).toEqual(customised.institutions);
    expect(applied.formId).toBe(customised.formId);
    // A preset equal to the form's own set leaves nothing to keep.
    const formSet = getGovernmentForm(government.formId)!.components;
    expect(applyPreset(customised, [...formSet]).components).toBeNull();
  });

  it("keeps only real institution renames", () => {
    const { government } = namedDraft();
    const form = getGovernmentForm(government.formId)!;
    const renamed = renameInstitution(government, "legislatureName", "Althing");
    expect(renamed.institutions).toEqual({ legislatureName: "Althing" });
    expect(
      renameInstitution(renamed, "legislatureName", form.institutions.legislatureName).institutions
    ).toEqual({});
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

describe("payload", () => {
  it("never sends the explicit regime's payloads", () => {
    const input = createInput(namedDraft(), "ixnay") as Record<string, unknown>;
    expect(input).not.toHaveProperty("taxSystemData");
    expect(input).not.toHaveProperty("governmentStructure");
    expect(input).not.toHaveProperty("economyBuilderState");
    expect(input).toMatchObject({
      name: "Valoria",
      realmId: "ixnay",
      archetypeId: "nordic",
      governmentFormId: getArchetypeDisplay("nordic")!.startingGovernmentForm,
      governmentComponents: undefined,
      economicInputs: { nationalIdentity: { countryName: "Valoria", capitalCity: "Port Val" } },
    });
  });

  it("sends components only once customised, and exact figures in coreIndicators", () => {
    const draft = namedDraft();
    const custom: FoundingDraft = {
      ...draft,
      government: toggleComponent(draft.government, "SURVEILLANCE_SYSTEM"),
      identity: { ...draft.identity, nationalAnimal: "Lynx" },
      economy: { ...draft.economy, exactPopulation: 8_400_000 },
    };
    const input = createInput(custom, undefined);
    expect(input.governmentComponents?.map((c) => c.componentType)).toContain(
      "SURVEILLANCE_SYSTEM"
    );
    expect(input.economicInputs?.coreIndicators).toEqual({
      totalPopulation: 8_400_000,
      gdpPerCapita: 0,
      nominalGDP: 0,
    });
    expect(input.economicInputs?.nationalIdentity).toMatchObject({ nationalAnimal: "Lynx" });
  });

  it("the preview carries the same figure fields as the founding", () => {
    const draft = namedDraft();
    const {
      name: _name,
      realmId: _realm,
      institutionNames: _n,
      economicInputs,
      ...founding
    } = createInput(draft, "ixnay");
    const { economicInputs: previewEcon, ...preview } = previewInput(draft);
    expect(preview).toEqual(founding);
    expect(previewEcon?.coreIndicators).toEqual(economicInputs?.coreIndicators);
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

  it("maps each infobox field, with the raw government value", () => {
    const nation = readInfobox(infobox, "iiwiki", "Valoria");
    expect(nation).toMatchObject({
      name: "Valoria",
      flagUrl: "https://iiwiki.com/images/flag.png",
      capitalCity: "Port Val",
      population: 12_500_000,
      gdpPerCapita: 61_000,
      government: {
        raw: "Federal parliamentary constitutional monarchy",
        formId: "constitutional-monarchy",
      },
      officialLanguages: "Valorian",
      currency: "Valorian crown",
      motto: "Onward",
    });
  });

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

  it("suggests nothing without a match", () => {
    expect(suggestArchetype({})).toBeNull();
    expect(suggestArchetype({ formId: "military-government" })).toBeNull();
    expect(suggestArchetype({ formId: "one-party-state" })).toBe("soviet-command");
  });
});

describe("founding errors", () => {
  it("names the fix for each refusal", () => {
    expect(
      describeFoundingError({ message: 'A country named "X" already exists in this realm' }, false)
        .fix?.step
    ).toBe("identity");
    expect(
      describeFoundingError(
        {
          message: "You already hold 1 nation in this realm, the most your account may hold there.",
        },
        true
      ).fix?.step
    ).toBe("realm");
    expect(
      describeFoundingError({ message: '"X" is a nation of this realm\'s lore: claim it' }, false)
        .title
    ).toMatch(/lore/);
  });
});
