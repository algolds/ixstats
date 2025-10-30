"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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
  // Reference point for calculating progressing time
  referenceTimestamp: number;
  referenceRealTime: number;
}

interface IxTimeContextType extends IxTimeState {
  refreshTime: () => Promise<void>;
}

const IxTimeContext = createContext<IxTimeContextType | null>(null);

interface IxTimeProviderProps {
  children: ReactNode;
  updateInterval?: number;
}

export function IxTimeProvider({ children, updateInterval = 100 }: IxTimeProviderProps) {
  const [timeState, setTimeState] = useState<IxTimeState>({
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
  });

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
      } else {
        // Fallback to client-side calculation
        return fallbackToClientSide();
      }
    } catch (error) {
      console.error("Error fetching time from API:", error);
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

  // Calculate current progressing time based on reference point
  const calculateProgressingTime = (state: IxTimeState): IxTimeState => {
    if (state.isPaused || state.multiplier === 0) {
      // Time is paused, return reference time
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

  const refreshTime = async () => {
    const newStateData = await fetchTimeFromAPI();
    setTimeState((prevState) => ({ ...prevState, ...newStateData }));
  };

  useEffect(() => {
    let active = true;
    let syncInterval: NodeJS.Timeout;
    let tickInterval: NodeJS.Timeout;

    const syncFromServer = async () => {
      if (!active) return;
      const newStateData = await fetchTimeFromAPI();
      if (active) {
        setTimeState((prevState) => ({ ...prevState, ...newStateData }));
      }
    };

    const tick = () => {
      if (!active) return;
      setTimeState((prevState) => calculateProgressingTime(prevState));
    };

    // Initial sync
    syncFromServer();

    // Set up intervals
    tickInterval = setInterval(tick, updateInterval); // Fast ticking for smooth time
    syncInterval = setInterval(syncFromServer, 30000); // Sync with server every 30s

    return () => {
      active = false;
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [updateInterval]);

  const contextValue: IxTimeContextType = {
    ...timeState,
    refreshTime,
  };

  return <IxTimeContext.Provider value={contextValue}>{children}</IxTimeContext.Provider>;
}

export function useIxTime(): IxTimeContextType {
  const context = useContext(IxTimeContext);
  if (!context) {
    throw new Error("useIxTime must be used within an IxTimeProvider");
  }
  return context;
}

// Convenience hooks for specific values
export function useCurrentIxTime(): number {
  const { ixTimeTimestamp } = useIxTime();
  return ixTimeTimestamp;
}

export function useFormattedIxTime(): string {
  const { ixTimeFormatted } = useIxTime();
  return ixTimeFormatted;
}

export function useCurrentGameYear(): number {
  const { gameYear } = useIxTime();
  return gameYear;
}

export function useTimeMultiplier(): number {
  const { multiplier } = useIxTime();
  return multiplier;
}
