// Standard staleTime constants (in milliseconds)
export const STALE_TIME = {
  FREQUENT: 30_000, // 30 seconds - budget years, allocations
  STANDARD: 60_000, // 60 seconds - departments, components
  STABLE: 300_000, // 5 minutes - structure, synergies
} as const;
