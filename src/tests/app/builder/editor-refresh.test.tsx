/**
 * Country editor refresh: section change counts, the government-component
 * nudge (no compounding on reload), recovered drafts, and the save bar.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  countChangesBySection,
  describeChangePath,
  sectionOfChange,
} from "~/app/builder/lib/edit-changes";
import { applyGovernmentComponentNudges } from "~/app/builder/lib/government-component-nudges";
import { mergeRecoveredDraft } from "~/app/builder/lib/recovered-draft";
import { baseInitialState, type BuilderState } from "~/app/builder/hooks/builderStateTypes";
import { createDefaultEconomicInputs } from "~/app/builder/lib/default-economic-inputs";
import { ComponentType } from "~/lib/enums";
import { EditorSaveBar } from "~/app/builder/components/EditorSaveBar";
import { describeSaveStatus } from "~/app/builder/components/editor/editor-sections";

jest.mock("~/lib/sound/cuelume", () => ({
  soundEffects: { press: jest.fn(), bloom: jest.fn(), tick: jest.fn(), toggle: jest.fn() },
}));

describe("editor sections", () => {
  it("maps each saved field to the section that edits it", () => {
    expect(sectionOfChange("economicInputs.nationalIdentity.capitalCity")).toBe("identity");
    expect(sectionOfChange("economicInputs.countryName")).toBe("identity");
    expect(sectionOfChange("economicInputs.coreIndicators.nominalGDP")).toBe("identity");
    expect(sectionOfChange("economicInputs.flagUrl")).toBe("identity");
    expect(sectionOfChange("governmentComponents")).toBe("government");
    expect(sectionOfChange("governmentStructure.structure.headOfState")).toBe("government");
    expect(sectionOfChange("economicInputs.governmentSpending.totalSpending")).toBe("government");
    expect(sectionOfChange("economicInputs.laborEmployment.unemploymentRate")).toBe("economics");
    expect(sectionOfChange("taxSystemData.taxSystem.taxSystemName")).toBe("economics");
    expect(sectionOfChange("economyBuilderState.sectors")).toBe("economics");
  });

  it("counts changes per section", () => {
    expect(
      countChangesBySection([
        { path: "economicInputs.nationalIdentity.motto", value: "Onward" },
        { path: "economicInputs.countryName", value: "Caphiria" },
        { path: "governmentComponents" },
        { path: "economicInputs.fiscalSystem.taxRevenueGDPPercent", value: 30 },
      ])
    ).toEqual({ identity: 2, government: 1, economics: 1 });
  });

  it("describes a field path in words", () => {
    expect(describeChangePath("economicInputs.nationalIdentity.capitalCity")).toBe("Capital city");
    expect(describeChangePath("economicInputs.coreIndicators.nominalGDP")).toBe("Nominal GDP");
    expect(describeChangePath("governmentComponents")).toBe("Government components");
    expect(describeChangePath("economicInputs.nationalIdentity.internetTLD")).toBe("Internet TLD");
  });
});

describe("applyGovernmentComponentNudges", () => {
  const inputs = createDefaultEconomicInputs();
  inputs.fiscalSystem = { ...inputs.fiscalSystem, taxRevenueGDPPercent: 25 };

  it("nudges tax revenue once, when Social Democracy is added", () => {
    const nudged = applyGovernmentComponentNudges(inputs, [], [ComponentType.SOCIAL_DEMOCRACY]);
    expect(nudged?.fiscalSystem.taxRevenueGDPPercent).toBeCloseTo(30);
    // The original object is untouched.
    expect(inputs.fiscalSystem.taxRevenueGDPPercent).toBe(25);
  });

  it("does nothing when the component was already there (reload, other component added)", () => {
    expect(
      applyGovernmentComponentNudges(
        inputs,
        [ComponentType.SOCIAL_DEMOCRACY],
        [ComponentType.SOCIAL_DEMOCRACY]
      )
    ).toBeNull();
    const withFreeMarket = applyGovernmentComponentNudges(
      inputs,
      [ComponentType.SOCIAL_DEMOCRACY],
      [ComponentType.SOCIAL_DEMOCRACY, ComponentType.FREE_MARKET_SYSTEM]
    );
    expect(withFreeMarket?.fiscalSystem.taxRevenueGDPPercent).toBeCloseTo(20);
  });
});

describe("mergeRecoveredDraft", () => {
  const loaded: BuilderState = {
    ...baseInitialState,
    step: "government",
    economicInputs: createDefaultEconomicInputs(),
  };

  it("applies the draft's saved fields and keeps navigation state", () => {
    const draftInputs = createDefaultEconomicInputs();
    draftInputs.countryName = "Caphiria";
    draftInputs.nationalIdentity = {
      ...draftInputs.nationalIdentity!,
      capitalCity: "Venceia",
      drivingSide: "right",
    };
    const draft: BuilderState = {
      ...baseInitialState,
      step: "core",
      economicInputs: draftInputs,
      governmentComponents: [ComponentType.SOCIAL_DEMOCRACY],
    };
    const merged = mergeRecoveredDraft(
      {
        ...loaded,
        economicInputs: {
          ...loaded.economicInputs!,
          nationalIdentity: { ...loaded.economicInputs!.nationalIdentity!, drivingSide: "left" },
        },
      },
      draft
    );
    expect(merged.step).toBe("government");
    expect(merged.economicInputs?.countryName).toBe("Caphiria");
    expect(merged.economicInputs?.nationalIdentity?.capitalCity).toBe("Venceia");
    // A draft can switch the driving side back to the right.
    expect(merged.economicInputs?.nationalIdentity?.drivingSide).toBe("right");
    expect(merged.governmentComponents).toEqual([ComponentType.SOCIAL_DEMOCRACY]);
  });

  it("ignores a draft without economic inputs", () => {
    expect(mergeRecoveredDraft(loaded, { ...baseInitialState })).toBe(loaded);
  });
});

describe("EditorSaveBar", () => {
  const baseProps = {
    changeCount: 0,
    canUndo: false,
    onUndo: jest.fn(),
    onDiscard: jest.fn(),
    onSave: jest.fn(),
    isSaving: false,
    status: "saved" as const,
    lastSyncedAt: null,
    onRetry: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("stays visible with nothing to save", () => {
    render(<EditorSaveBar {...baseProps} />);
    expect(screen.getByRole("region", { name: "Editor changes" })).toBeInTheDocument();
    expect(screen.getByText("No changes")).toBeInTheDocument();
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard/i })).toBeDisabled();
  });

  it("counts changes and saves or discards them", () => {
    render(<EditorSaveBar {...baseProps} changeCount={3} canUndo status="pending" />);
    expect(screen.getByText("3 changes")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    fireEvent.click(screen.getByRole("button", { name: /undo last change/i }));
    expect(baseProps.onSave).toHaveBeenCalledTimes(1);
    expect(baseProps.onDiscard).toHaveBeenCalledTimes(1);
    expect(baseProps.onUndo).toHaveBeenCalledTimes(1);
  });

  it("offers a retry when a save failed", () => {
    render(<EditorSaveBar {...baseProps} changeCount={1} status="error" />);
    expect(screen.getByText(/couldn't save/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(baseProps.onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("describeSaveStatus", () => {
  it("names the autosave state", () => {
    expect(describeSaveStatus("saving", null)).toBe("Saving…");
    expect(describeSaveStatus("saved", null)).toBe("All changes saved");
    expect(describeSaveStatus("saved", new Date(2026, 0, 1, 10, 42))).toMatch(
      /^All changes saved at /
    );
  });
});
