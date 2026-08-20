"use client";

import { create } from "zustand";
import { IxTime } from "~/lib/ixtime";
import { withBasePath } from "~/lib/base-path";

interface IxTimeState {
  ixTimeTimestamp: number;
  ixTimeFormatted: string;
  multiplier: number;
  isPaused: boolean;
  gameYear: number;
  isNaturalProgression: boolean;
  isLoading: boolean;
  lastUpdated: number;
  referenceTimestamp: number;
  referenceRealTime: number;
}

interface IxTimeActions {
  refreshTime: () => Promise<void>;
  tick: () => void;
  applyExternalTimeUpdate: (update: Partial<IxTimeState>) => void;
}

type IxTimeStore = IxTimeState & IxTimeActions;

const initialState: IxTimeState = {
  ixTimeTimestamp: Date.now(),
  ixTimeFormatted: "",
  multiplier: 2,
  isPaused: false,
  gameYear: 2040,
  isNaturalProgression: true,
  isLoading: true,
  lastUpdated: Date.now(),
  referenceTimestamp: Date.now(),
  referenceRealTime: Date.now(),
};

const fetchTimeFromAPI = async (): Promise<Partial<IxTimeState>> => {
  try {
    const response = await fetch(withBasePath("/api/ixtime/current"));
    if (response.ok) {
      const data = await response.json();
      const now = Date.now();
      return {
        referenceTimestamp: data.ixTimeTimestamp,
        referenceRealTime: now,
        multiplier: data.multiplier,
        isPaused: data.isPaused,
        gameYear: data.gameYear,
        isNaturalProgression: data.status?.isMultiplierNatural ?? true,
        isLoading: false,
        lastUpdated: now,
      };
    }
    return fallbackToClientSide();
  } catch {
    return fallbackToClientSide();
  }
};

const fallbackToClientSide = (): Partial<IxTimeState> => {
  const ixTime = IxTime.getCurrentIxTime();
  const now = Date.now();
  return {
    referenceTimestamp: ixTime,
    referenceRealTime: now,
    multiplier: IxTime.getTimeMultiplier(),
    isPaused: IxTime.isPaused(),
    gameYear: IxTime.getCurrentGameYear(),
    isNaturalProgression: IxTime.isMultiplierNatural(),
    isLoading: false,
    lastUpdated: now,
  };
};

const calculateProgressingTime = (state: IxTimeState): IxTimeState => {
  if (state.isPaused || state.multiplier === 0) {
    return {
      ...state,
      ixTimeTimestamp: state.referenceTimestamp,
      ixTimeFormatted: IxTime.formatIxTime(state.referenceTimestamp, true),
    };
  }

  const now = Date.now();
  const realTimeElapsed = now - state.referenceRealTime;
  const ixTimeElapsed = realTimeElapsed * state.multiplier;
  const currentIxTime = state.referenceTimestamp + ixTimeElapsed;

  return {
    ...state,
    ixTimeTimestamp: currentIxTime,
    ixTimeFormatted: IxTime.formatIxTime(currentIxTime, true),
    gameYear: IxTime.getCurrentGameYear(currentIxTime),
  };
};

export const useIxTimeStore = create<IxTimeStore>()((set, get) => ({
  ...initialState,

  tick: () => {
    set((state) => calculateProgressingTime(state));
  },

  refreshTime: async () => {
    const newStateData = await fetchTimeFromAPI();
    set((state) => ({ ...state, ...newStateData }));
  },

  applyExternalTimeUpdate: (update: Partial<IxTimeState>) => {
    const now = Date.now();
    set((state) => ({
      ...state,
      ...update,
      referenceRealTime: update.referenceRealTime ?? now,
      lastUpdated: now,
      isLoading: false,
    }));
  },
}));

// Selector hooks for granular subscriptions — components only re-render when their value changes
export const useIxTimeTimestamp = () => useIxTimeStore((s) => s.ixTimeTimestamp);
export const useIxTimeFormatted = () => useIxTimeStore((s) => s.ixTimeFormatted);
export const useIxTimeGameYear = () => useIxTimeStore((s) => s.gameYear);
export const useIxTimeMultiplier = () => useIxTimeStore((s) => s.multiplier);
export const useIxTimeIsPaused = () => useIxTimeStore((s) => s.isPaused);
export const useIxTimeAll = () =>
  useIxTimeStore((s) => ({
    ixTimeTimestamp: s.ixTimeTimestamp,
    ixTimeFormatted: s.ixTimeFormatted,
    multiplier: s.multiplier,
    isPaused: s.isPaused,
    gameYear: s.gameYear,
    isNaturalProgression: s.isNaturalProgression,
    isLoading: s.isLoading,
  }));
export const useIxTimeActions = () =>
  useIxTimeStore((s) => ({ tick: s.tick, refreshTime: s.refreshTime }));
