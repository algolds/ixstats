import { renderHook } from "@testing-library/react";
import { useBuilderKeyboardShortcuts } from "~/app/builder/hooks/useBuilderKeyboardShortcuts";
import { sanitizeEconomicInputs, getInitialState } from "~/app/builder/hooks/builderStateTypes";
import { createDefaultEconomicInputs, type EconomicInputs } from "~/app/builder/lib/economy-data-service";
import {
  countryGovernmentStructureInputSchema,
  countryEconomyBuilderStateSchema,
} from "~/server/shared/country-payload-builder";
import { soundEffects } from "~/lib/sound/cuelume";

// Mock cuelume soundEffects
jest.mock("~/lib/sound/cuelume", () => ({
  soundEffects: {
    bloom: jest.fn(),
    tick: jest.fn(),
    toggle: jest.fn(),
  },
}));

describe("Country Builder & Editor - Unification Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useBuilderKeyboardShortcuts", () => {
    it("calls onSave and triggers bloom sound on Meta+S (⌘S)", () => {
      const onSave = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onSave,
          isSubmitting: false,
        })
      );

      const event = new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(soundEffects.bloom).toHaveBeenCalledTimes(1);
    });

    it("calls onSave and triggers bloom sound on Ctrl+S", () => {
      const onSave = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onSave,
          isSubmitting: false,
        })
      );

      const event = new KeyboardEvent("keydown", {
        key: "S",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(soundEffects.bloom).toHaveBeenCalledTimes(1);
    });

    it("calls onReset and triggers tick sound on Meta+Shift+D (⌘⇧D)", () => {
      const onReset = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onReset,
          isSubmitting: false,
        })
      );

      const event = new KeyboardEvent("keydown", {
        key: "d",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(soundEffects.tick).toHaveBeenCalledTimes(1);
    });

    it("calls onToggleAdvanced and triggers toggle sound on Meta+Shift+A (⌘⇧A)", () => {
      const onToggleAdvanced = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onToggleAdvanced,
          isSubmitting: false,
        })
      );

      const event = new KeyboardEvent("keydown", {
        key: "a",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(onToggleAdvanced).toHaveBeenCalledTimes(1);
      expect(soundEffects.toggle).toHaveBeenCalledTimes(1);
    });

    it("calls onToggleAdvanced and triggers toggle sound on Ctrl+Shift+A", () => {
      const onToggleAdvanced = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onToggleAdvanced,
          isSubmitting: false,
        })
      );

      const event = new KeyboardEvent("keydown", {
        key: "A",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(onToggleAdvanced).toHaveBeenCalledTimes(1);
      expect(soundEffects.toggle).toHaveBeenCalledTimes(1);
    });

    it("does not trigger onSave or onReset or onToggleAdvanced when isSubmitting is true", () => {
      const onSave = jest.fn();
      const onReset = jest.fn();
      const onToggleAdvanced = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onSave,
          onReset,
          onToggleAdvanced,
          isSubmitting: true,
        })
      );

      const advanceEvent = new KeyboardEvent("keydown", {
        key: "a",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(advanceEvent);

      expect(onToggleAdvanced).not.toHaveBeenCalled();
      expect(soundEffects.toggle).not.toHaveBeenCalled();

      const saveEvent = new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(saveEvent);

      const resetEvent = new KeyboardEvent("keydown", {
        key: "d",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(resetEvent);

      expect(onSave).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
      expect(soundEffects.bloom).not.toHaveBeenCalled();
      expect(soundEffects.tick).not.toHaveBeenCalled();
    });

    it("ignores keypresses when modifier keys (meta/ctrl) are absent", () => {
      const onSave = jest.fn();
      const onReset = jest.fn();
      renderHook(() =>
        useBuilderKeyboardShortcuts({
          onSave,
          onReset,
          isSubmitting: false,
        })
      );

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "d", shiftKey: true, bubbles: true })
      );

      expect(onSave).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe("sanitizeEconomicInputs", () => {
    it("correctly sanitizes and bounds labor employment percentages", () => {
      const inputs: Partial<EconomicInputs> = {
        laborEmployment: {
          laborForceParticipationRate: 150, // exceeds 100
          unemploymentRate: -10, // below 0
          employmentRate: 95,
        } as EconomicInputs["laborEmployment"],
      };

      const result = sanitizeEconomicInputs(inputs);
      expect(result?.laborEmployment?.laborForceParticipationRate).toBe(100);
      expect(result?.laborEmployment?.unemploymentRate).toBe(0);
    });

    it("falls back to sensible defaults when NaN is provided", () => {
      const inputs: Partial<EconomicInputs> = {
        laborEmployment: {
          laborForceParticipationRate: Number.NaN,
          unemploymentRate: Number.NaN,
          employmentRate: 90,
        } as EconomicInputs["laborEmployment"],
      };

      const result = sanitizeEconomicInputs(inputs);
      expect(result?.laborEmployment?.laborForceParticipationRate).toBe(65);
      expect(result?.laborEmployment?.unemploymentRate).toBe(5);
    });
  });

  describe("createDefaultEconomicInputs", () => {
    it("creates baseline data with correct core indicators", () => {
      const inputs = createDefaultEconomicInputs({
        name: "Aethelgard",
        countryCode: "at",
        population: 50000000,
        gdpPerCapita: 45000,
        gdp: 2250000000000,
        unemploymentRate: 4.5,
        taxRevenuePercent: 28,
      });

      expect(inputs.countryName).toBe("Aethelgard");
      expect(inputs.coreIndicators.totalPopulation).toBe(50000000);
      expect(inputs.coreIndicators.gdpPerCapita).toBe(45000);
      expect(inputs.coreIndicators.nominalGDP).toBe(2250000000000);
      expect(inputs.laborEmployment.unemploymentRate).toBe(4.5);
      expect(inputs.fiscalSystem.taxRevenueGDPPercent).toBe(28);
    });
  });

  describe("countryPayloadBuilder Schemas", () => {
    it("validates government structure with department functions and kpi arrays", () => {
      const payload = {
        governmentName: "Government of Valoria",
        governmentType: "Republic",
        departments: [
          {
            name: "Ministry of Justice",
            category: "Justice",
            functions: ["Enforce laws", "Oversee judiciary"],
            kpis: ["Clearance rate", "Incarceration rate"],
          },
        ],
      };

      const parsed = countryGovernmentStructureInputSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it("validates economy builder state with array sectors", () => {
      const payload = {
        selectedAtomicComponents: ["CENTRAL_BANK"],
        sectors: [
          {
            id: "sec-1",
            name: "Agriculture",
            category: "Primary",
            gdpContribution: 5,
            employmentShare: 8,
          },
        ],
        structure: {
          economicModel: "Mixed Economy",
          totalGDP: 1000000,
        },
      };

      const parsed = countryEconomyBuilderStateSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it("validates economy builder state with structure as an array (sectorBreakdown format)", () => {
      const payload = {
        structure: [
          {
            name: "Agriculture",
            gdp: 5,
            employment: 8,
          },
        ],
        sectors: [],
      };

      const parsed = countryEconomyBuilderStateSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });
  });

  describe("Progressive Disclosure - Editor Full Capability Guarantee (Option A)", () => {
    it("guarantees showAdvancedMode is true and step is core when mode is edit", () => {
      const state = getInitialState("edit");
      expect(state.showAdvancedMode).toBe(true);
      expect(state.step).toBe("core");
      expect(state.completedSteps).toContain("foundation");
    });

    it("defaults to foundation step for create mode", () => {
      const state = getInitialState("create");
      expect(state.step).toBe("foundation");
    });
  });
});

