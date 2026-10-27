/**
 * The "First steps" checklist MyCountry shows a newly founded nation. Each step ticks itself from
 * the data its console writes, so the rules live here, shared by the server query and the card.
 */

export const FIRST_STEP_IDS = ["budget", "tax", "cabinet", "wiki", "capital"] as const;
export type FirstStepId = (typeof FIRST_STEP_IDS)[number];

export interface FirstStepItem {
  id: FirstStepId;
  done: boolean;
  /** The console that owns the step. */
  href: string;
}

export interface FirstSteps {
  countryId: string;
  /** The player hid the card for this nation. */
  dismissed: boolean;
  /** Founded (or taken over) recently enough for a checklist to make sense. */
  recent: boolean;
  /** Empty when the card would not show anyway (dismissed or not recent). */
  items: FirstStepItem[];
}

/**
 * Founding writes the budget, fiscal and tax rows in the same request that creates the nation, a
 * moment after its `createdAt`. A row counts as changed only when it was written after this
 * window, so the rows founding made never tick a step on their own.
 */
export const FOUNDING_GRACE_MS = 30_000;

/** Nations older than this never see the checklist: it is for the first weeks of a nation. */
export const FIRST_STEPS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * When the player got the nation: its creation, or the later moment they took it over (a claimed
 * nation can be years older than its owner's tenure).
 */
export function foundedAt(country: { createdAt: Date; ownedSince?: Date | null }): Date {
  const owned = country.ownedSince;
  return owned && owned.getTime() > country.createdAt.getTime() ? owned : country.createdAt;
}

/** The moment after which a row write is the player's own change, not founding's. */
export function changedAfter(founded: Date): Date {
  return new Date(founded.getTime() + FOUNDING_GRACE_MS);
}

export function isFoundedRecently(founded: Date, now: Date = new Date()): boolean {
  return now.getTime() - founded.getTime() <= FIRST_STEPS_WINDOW_MS;
}

/** True when `at` is after `threshold`; a missing row never counts. */
export function writtenAfter(at: Date | null | undefined, threshold: Date): boolean {
  return at != null && at.getTime() > threshold.getTime();
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Whether a city's stored `coordinates` place it on the map: a `[lng, lat]` pair (what the map
 * editor saves) or a GeoJSON point (what imports save).
 */
export function hasMapCoordinates(coordinates: unknown): boolean {
  if (Array.isArray(coordinates)) {
    return (
      coordinates.length >= 2 && isFiniteNumber(coordinates[0]) && isFiniteNumber(coordinates[1])
    );
  }
  if (coordinates && typeof coordinates === "object" && "coordinates" in coordinates) {
    return hasMapCoordinates((coordinates as { coordinates: unknown }).coordinates);
  }
  return false;
}

/** The card shows only while it has something left to do and the player has not hidden it. */
export function shouldShowFirstSteps(steps: FirstSteps | null | undefined): steps is FirstSteps {
  return (
    !!steps &&
    !steps.dismissed &&
    steps.recent &&
    steps.items.length > 0 &&
    steps.items.some((item) => !item.done)
  );
}
