/**
 * Unified Country Builder Store (Zustand)
 *
 * Single source of truth for the multi-step Country Builder workflow:
 * - National Identity
 * - Government & Atomic Components
 * - Economy & Macroeconomics
 * - Tax System & Revenue Allocation
 *
 * Replaces legacy EventEmitter singletons with reactive Zustand state and pure calculations.
 */

import { create } from "zustand";
import type { RevenueSourceInput, ComponentType } from "~/types/government";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

export interface IdentitySlice {
  countryName: string;
  capital: string;
  currency: string;
  currencySymbol: string;
  language: string;
  flagUrl: string;
  selectedArchetypeId: string | null;
  selectedCountryId: string | null;
}

export interface GovernmentSlice {
  governmentType: string;
  headOfState: string;
  headOfGovernment: string;
  legislatureName: string;
  executiveName: string;
  judicialName: string;
  totalBudget: number;
  fiscalYear: string;
  selectedAtomicComponents: string[];
  departments: Array<{
    name: string;
    category: string;
    budget: number;
    description?: string;
  }>;
  revenueSources: RevenueSourceInput[];
}

export interface EconomySlice {
  gdp: number;
  population: number;
  inflation: number;
  growthRate: number;
  economicInputs: Partial<EconomicInputs>;
}

export interface TaxSlice {
  taxSystemType: "progressive" | "flat" | "regressive" | "custom";
  overallTaxBurden: number;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    rate: number;
    enabled: boolean;
  }>;
}

export interface BuilderState {
  currentStep: number;
  identity: IdentitySlice;
  government: GovernmentSlice;
  economy: EconomySlice;
  tax: TaxSlice;

  // Actions
  setStep: (step: number) => void;
  setIdentity: (patch: Partial<IdentitySlice>) => void;
  setGovernment: (patch: Partial<GovernmentSlice>) => void;
  setEconomy: (patch: Partial<EconomySlice>) => void;
  setTax: (patch: Partial<TaxSlice>) => void;
  toggleAtomicComponent: (componentId: string) => void;
  updateEconomicInputs: (inputs: Partial<EconomicInputs>) => void;
  resetBuilder: () => void;
}

const DEFAULT_IDENTITY: IdentitySlice = {
  countryName: "",
  capital: "",
  currency: "Ixnay Dollar",
  currencySymbol: "§",
  language: "English",
  flagUrl: "",
  selectedArchetypeId: null,
  selectedCountryId: null,
};

const DEFAULT_GOVERNMENT: GovernmentSlice = {
  governmentType: "Parliamentary Democracy",
  headOfState: "",
  headOfGovernment: "",
  legislatureName: "Parliament",
  executiveName: "Cabinet",
  judicialName: "Supreme Court",
  totalBudget: 100000000,
  fiscalYear: "Calendar",
  selectedAtomicComponents: [],
  departments: [],
  revenueSources: [],
};

const DEFAULT_ECONOMY: EconomySlice = {
  gdp: 500000000,
  population: 10000000,
  inflation: 2.0,
  growthRate: 2.5,
  economicInputs: {},
};

const DEFAULT_TAX: TaxSlice = {
  taxSystemType: "progressive",
  overallTaxBurden: 28,
  categories: [],
};

export const useBuilderStore = create<BuilderState>((set) => ({
  currentStep: 1,
  identity: DEFAULT_IDENTITY,
  government: DEFAULT_GOVERNMENT,
  economy: DEFAULT_ECONOMY,
  tax: DEFAULT_TAX,

  setStep: (step) => set({ currentStep: step }),

  setIdentity: (patch) =>
    set((state) => ({
      identity: { ...state.identity, ...patch },
    })),

  setGovernment: (patch) =>
    set((state) => ({
      government: { ...state.government, ...patch },
    })),

  setEconomy: (patch) =>
    set((state) => ({
      economy: { ...state.economy, ...patch },
    })),

  setTax: (patch) =>
    set((state) => ({
      tax: { ...state.tax, ...patch },
    })),

  toggleAtomicComponent: (componentId) =>
    set((state) => {
      const exists = state.government.selectedAtomicComponents.includes(componentId);
      const updated = exists
        ? state.government.selectedAtomicComponents.filter((id) => id !== componentId)
        : [...state.government.selectedAtomicComponents, componentId];
      return {
        government: {
          ...state.government,
          selectedAtomicComponents: updated,
        },
      };
    }),

  updateEconomicInputs: (inputs) =>
    set((state) => ({
      economy: {
        ...state.economy,
        economicInputs: { ...state.economy.economicInputs, ...inputs },
      },
    })),

  resetBuilder: () =>
    set({
      currentStep: 1,
      identity: DEFAULT_IDENTITY,
      government: DEFAULT_GOVERNMENT,
      economy: DEFAULT_ECONOMY,
      tax: DEFAULT_TAX,
    }),
}));
