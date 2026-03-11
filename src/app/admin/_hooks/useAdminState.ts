// src/app/admin/_hooks/useAdminState.ts
// State management for admin panel

import { useState } from "react";
import { CONFIG_CONSTANTS } from "~/lib/config-service";
import type { ImportAnalysis } from "~/types/ixstats";

export interface AdminConfig {
  globalGrowthFactor: number;
  autoUpdate: boolean;
  botSyncEnabled: boolean;
  timeMultiplier: number;
  // Economic control parameters
  baseInflationRate: number;
  tierGrowthModifiers: Record<string, number>;
  diminishingReturnsThreshold: number;
  diminishingReturnsFactor: number;
  minGrowthFloor: number;
}

export interface TimeState {
  customDate: string;
  customTime: string;
}

export interface ImportState {
  isUploading: boolean;
  isAnalyzing: boolean;
  analyzeError: string | null;
  importError: string | null;
  previewData: ImportAnalysis | null;
  showPreview: boolean;
  fileData: number[] | null;
  fileName: string | null;
}

export interface ActionState {
  calculationPending: boolean;
  setTimePending: boolean;
  savePending: boolean;
  syncPending: boolean;
  pausePending: boolean;
  resumePending: boolean;
  clearPending: boolean;
  syncEpochPending: boolean;
  autoSyncPending: boolean;
  lastUpdate: Date | null;
  lastBotSync: Date | null;
}

export function useAdminState() {
  const [config, setConfig] = useState<AdminConfig>({
    globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR as number,
    autoUpdate: true,
    botSyncEnabled: true,
    timeMultiplier: 2.0,
    baseInflationRate: 0.02,
    tierGrowthModifiers: {
      Impoverished: 1.0,
      Developing: 1.0,
      Developed: 1.0,
      Healthy: 1.0,
      Strong: 1.0,
      "Very Strong": 1.0,
      Extravagant: 1.0,
    },
    diminishingReturnsThreshold: 60000,
    diminishingReturnsFactor: 0.5,
    minGrowthFloor: -0.1,
  });

  const [timeState, setTimeState] = useState<TimeState>({
    customDate: new Date().toISOString().split("T")[0] || "",
    customTime: "12:00",
  });

  const [importState, setImportState] = useState<ImportState>({
    isUploading: false,
    isAnalyzing: false,
    analyzeError: null,
    importError: null,
    previewData: null,
    showPreview: false,
    fileData: null,
    fileName: null,
  });

  const [actionState, setActionState] = useState<ActionState>({
    calculationPending: false,
    setTimePending: false,
    savePending: false,
    syncPending: false,
    pausePending: false,
    resumePending: false,
    clearPending: false,
    syncEpochPending: false,
    autoSyncPending: false,
    lastUpdate: null,
    lastBotSync: null,
  });

  return {
    config,
    setConfig,
    timeState,
    setTimeState,
    importState,
    setImportState,
    actionState,
    setActionState,
  };
}
