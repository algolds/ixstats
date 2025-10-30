/**
 * Tests for useBuilderValidation Hook
 */

import { renderHook } from "@testing-library/react";
import { useBuilderValidation } from "../../hooks/useBuilderValidation";
import type { BuilderState } from "../../hooks/useBuilderState";

describe("useBuilderValidation", () => {
  const createMockState = (overrides?: Partial<BuilderState>): BuilderState => ({
    step: "foundation",
    selectedCountry: null,
    economicInputs: null,
    governmentComponents: [],
    taxSystemData: null,
    governmentStructure: null,
    completedSteps: [],
    activeCoreTab: "identity",
    activeGovernmentTab: "components",
    activeEconomicsTab: "economy",
    showAdvancedMode: false,
    ...overrides,
  });

  describe("Initialization", () => {
    it("provides validation functions", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState(),
        })
      );

      expect(typeof result.current.validateStep).toBe("function");
      expect(typeof result.current.validateAll).toBe("function");
      expect(typeof result.current.canCreateCountry).toBe("boolean");
    });
  });

  describe("Foundation Step Validation", () => {
    it("fails validation without selected country", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({ selectedCountry: null }),
        })
      );

      const validation = result.current.validateStep("foundation");

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("passes validation with selected country", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            selectedCountry: { name: "Test" } as any,
          }),
        })
      );

      const validation = result.current.validateStep("foundation");

      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe("Core Step Validation", () => {
    it("fails without economic inputs", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({ economicInputs: null }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("fails without country name", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            economicInputs: {
              nationalIdentity: { countryName: "" },
              coreIndicators: { nominalGDP: 1000, population: 1000 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.toLowerCase().includes("name"))).toBe(true);
    });

    it("warns without capital city", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            economicInputs: {
              nationalIdentity: {
                countryName: "Test",
                capitalCity: "",
              },
              coreIndicators: { nominalGDP: 1000, population: 1000 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it("fails with zero GDP", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            economicInputs: {
              nationalIdentity: { countryName: "Test", capitalCity: "Capital" },
              coreIndicators: { nominalGDP: 0, population: 1000 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("GDP"))).toBe(true);
    });

    it("fails with zero population", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            economicInputs: {
              nationalIdentity: { countryName: "Test", capitalCity: "Capital" },
              coreIndicators: { nominalGDP: 1000, population: 0 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("population"))).toBe(true);
    });

    it("passes with valid inputs", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            economicInputs: {
              nationalIdentity: {
                countryName: "Test Country",
                capitalCity: "Test Capital",
              },
              coreIndicators: { nominalGDP: 1000000, population: 10000 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateStep("core");

      expect(validation.isValid).toBe(true);
    });
  });

  describe("Government Step Validation", () => {
    it("warns with no components", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({ governmentComponents: [] }),
        })
      );

      const validation = result.current.validateStep("government");

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it("warns with too few components", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            governmentComponents: ["parliament"] as any,
          }),
        })
      );

      const validation = result.current.validateStep("government");

      expect(validation.warnings.some((w) => w.includes("3"))).toBe(true);
    });

    it("warns with too many components", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            governmentComponents: Array(20).fill("component") as any,
          }),
        })
      );

      const validation = result.current.validateStep("government");

      expect(validation.warnings.some((w) => w.includes("15"))).toBe(true);
    });

    it("warns without government structure", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            governmentComponents: Array(5).fill("component") as any,
            governmentStructure: null,
          }),
        })
      );

      const validation = result.current.validateStep("government");

      expect(validation.warnings.some((w) => w.toLowerCase().includes("structure"))).toBe(true);
    });

    it("passes with valid configuration", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            governmentComponents: Array(5).fill("component") as any,
            governmentStructure: { type: "democracy" },
          }),
        })
      );

      const validation = result.current.validateStep("government");

      expect(validation.isValid).toBe(true);
    });
  });

  describe("Complete Validation", () => {
    it("fails if any step invalid", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            selectedCountry: null, // Invalid foundation
            economicInputs: {
              nationalIdentity: { countryName: "Test", capitalCity: "Capital" },
              coreIndicators: { nominalGDP: 1000, population: 1000 },
            } as any,
          }),
        })
      );

      const validation = result.current.validateAll();

      expect(validation.isValid).toBe(false);
    });

    it("passes with all valid steps", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            selectedCountry: { name: "Test" } as any,
            economicInputs: {
              nationalIdentity: { countryName: "Test", capitalCity: "Capital" },
              coreIndicators: { nominalGDP: 1000, population: 1000 },
            } as any,
            governmentComponents: Array(5).fill("component") as any,
          }),
        })
      );

      const validation = result.current.validateAll();

      expect(validation.isValid).toBe(true);
    });
  });

  describe("canCreateCountry", () => {
    it("is false when validation fails", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({ selectedCountry: null }),
        })
      );

      expect(result.current.canCreateCountry).toBe(false);
    });

    it("is true when all validations pass", () => {
      const { result } = renderHook(() =>
        useBuilderValidation({
          builderState: createMockState({
            selectedCountry: { name: "Test" } as any,
            economicInputs: {
              nationalIdentity: { countryName: "Test", capitalCity: "Capital" },
              coreIndicators: { nominalGDP: 1000, population: 1000 },
            } as any,
            governmentComponents: Array(5).fill("component") as any,
          }),
        })
      );

      expect(result.current.canCreateCountry).toBe(true);
    });
  });

  describe("Memoization", () => {
    it("memoizes validation results", () => {
      const state = createMockState({
        selectedCountry: { name: "Test" } as any,
      });

      const { result, rerender } = renderHook(() => useBuilderValidation({ builderState: state }));

      const firstValidation = result.current.validateStep("foundation");
      rerender();
      const secondValidation = result.current.validateStep("foundation");

      // Results should be stable
      expect(firstValidation.isValid).toBe(secondValidation.isValid);
    });
  });
});
