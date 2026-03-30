"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { FeatureCollection } from "geojson";
import type { StudioSection } from "../lib/studio-theme";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface WorldGenParamsUI {
  seed: number;
  /** Voronoi cell count (10000-50000) */
  cellCount: number;
  continentCount: number;
  countryCountRange: [number, number];
  oceanPercentage: number;
  terrainRoughness: number;
  hasIcecaps: boolean;
  hasRivers: boolean;
  hasLakes: boolean;
  /** Use IxWorld continent outlines as soft template */
  useIxWorldTemplate: boolean;
  /** Template adherence strength (0-1) */
  templateStrength: number;
  useMarkovNaming: boolean;
  languageFamilies: string[];
  preset: string;
}

export interface StudioState {
  realmId: string | null;
  realmName: string;
  realmDescription: string;
  step: StudioSection;
  worldGenParams: WorldGenParamsUI;
  generationStatus: "idle" | "generating" | "complete" | "error";
  generationProgress: number;
  generationMessage: string;
  previewLayers: Record<string, FeatureCollection> | null;
  generationStats: Record<string, number> | null;
  completedSections: Set<StudioSection>;
  uploadedImage: string | null;
}

type StudioAction =
  | { type: "SET_STEP"; step: StudioSection }
  | { type: "SET_REALM"; realmId: string; name: string }
  | { type: "SET_REALM_NAME"; name: string }
  | { type: "SET_REALM_DESCRIPTION"; description: string }
  | { type: "UPDATE_PARAMS"; params: Partial<WorldGenParamsUI> }
  | { type: "SET_GENERATION_STATUS"; status: StudioState["generationStatus"]; progress?: number; message?: string }
  | { type: "SET_PREVIEW"; layers: Record<string, FeatureCollection>; stats: Record<string, number> }
  | { type: "COMPLETE_SECTION"; section: StudioSection }
  | { type: "SET_UPLOADED_IMAGE"; image: string | null }
  | { type: "RESET" };

// ──────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────

export const DEFAULT_PARAMS: WorldGenParamsUI = {
  seed: Math.floor(Math.random() * 100000),
  cellCount: 20000,
  continentCount: 6,
  countryCountRange: [60, 200],
  oceanPercentage: 0.65,
  terrainRoughness: 0.5,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  useIxWorldTemplate: true,
  templateStrength: 0.6,
  useMarkovNaming: true,
  languageFamilies: [],
  preset: "ixworld",
};

export const PRESETS: Record<string, Partial<WorldGenParamsUI>> = {
  "ixworld": {
    cellCount: 20000, continentCount: 6, countryCountRange: [160, 200],
    oceanPercentage: 0.65, terrainRoughness: 0.5, useIxWorldTemplate: true, templateStrength: 0.6,
  },
  "earth-like": {
    cellCount: 20000, continentCount: 4, countryCountRange: [40, 80],
    oceanPercentage: 0.65, terrainRoughness: 0.5, useIxWorldTemplate: false,
  },
  "pangaea": {
    cellCount: 15000, continentCount: 1, countryCountRange: [15, 40],
    oceanPercentage: 0.5, terrainRoughness: 0.6, useIxWorldTemplate: false,
  },
  "archipelago": {
    cellCount: 20000, continentCount: 8, countryCountRange: [30, 80],
    oceanPercentage: 0.8, terrainRoughness: 0.3, useIxWorldTemplate: false,
  },
  "desert": {
    cellCount: 15000, continentCount: 3, countryCountRange: [10, 30],
    oceanPercentage: 0.5, terrainRoughness: 0.7, hasLakes: false, useIxWorldTemplate: false,
  },
  "waterworld": {
    cellCount: 20000, continentCount: 5, countryCountRange: [20, 50],
    oceanPercentage: 0.85, terrainRoughness: 0.3, useIxWorldTemplate: false,
  },
};

const INITIAL_STATE: StudioState = {
  realmId: null,
  realmName: "",
  realmDescription: "",
  step: "dashboard",
  worldGenParams: DEFAULT_PARAMS,
  generationStatus: "idle",
  generationProgress: 0,
  generationMessage: "",
  previewLayers: null,
  generationStats: null,
  completedSections: new Set(),
  uploadedImage: null,
};

// ──────────────────────────────────────────────
// Reducer
// ──────────────────────────────────────────────

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_REALM":
      return { ...state, realmId: action.realmId, realmName: action.name };
    case "SET_REALM_NAME":
      return { ...state, realmName: action.name };
    case "SET_REALM_DESCRIPTION":
      return { ...state, realmDescription: action.description };
    case "UPDATE_PARAMS":
      return { ...state, worldGenParams: { ...state.worldGenParams, ...action.params } };
    case "SET_GENERATION_STATUS":
      return {
        ...state,
        generationStatus: action.status,
        generationProgress: action.progress ?? state.generationProgress,
        generationMessage: action.message ?? state.generationMessage,
      };
    case "SET_PREVIEW":
      return {
        ...state,
        previewLayers: action.layers,
        generationStats: action.stats,
        generationStatus: "complete",
        generationProgress: 100,
      };
    case "COMPLETE_SECTION": {
      const next = new Set(state.completedSections);
      next.add(action.section);
      return { ...state, completedSections: next };
    }
    case "SET_UPLOADED_IMAGE":
      return { ...state, uploadedImage: action.image };
    case "RESET":
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

interface StudioContextValue {
  state: StudioState;
  dispatch: React.Dispatch<StudioAction>;
  navigateTo: (section: StudioSection) => void;
  updateParams: (params: Partial<WorldGenParamsUI>) => void;
  applyPreset: (preset: string) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);

  const navigateTo = useCallback(
    (section: StudioSection) => {
      dispatch({ type: "SET_STEP", step: section });
      window.history.pushState(null, "", `/studio/${section === "dashboard" ? "" : section}`);
    },
    []
  );

  const updateParams = useCallback(
    (params: Partial<WorldGenParamsUI>) => {
      dispatch({ type: "UPDATE_PARAMS", params });
    },
    []
  );

  const applyPreset = useCallback(
    (preset: string) => {
      const presetParams = PRESETS[preset];
      if (presetParams) {
        dispatch({ type: "UPDATE_PARAMS", params: { ...presetParams, preset } });
      }
    },
    []
  );

  const value = useMemo<StudioContextValue>(
    () => ({ state, dispatch, navigateTo, updateParams, applyPreset }),
    [state, navigateTo, updateParams, applyPreset]
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudioState(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudioState must be used within StudioStateProvider");
  return ctx;
}
