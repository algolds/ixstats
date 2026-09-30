import { useCallback } from "react";
import { api } from "~/trpc/react";

/**
 * After the editor saves a country: marks every cached view of it stale so the
 * next screen that reads it (MyCountry, the country page, the editor on its next
 * visit) refetches instead of showing the pre-save data.
 *
 * Queries are marked stale without refetching now (`refetchType: "none"`): the
 * editor autosaves every few seconds and must not reload its own data each time.
 * Flags are the exception: they resolve by name and are cached for an hour, so
 * active flag lookups refetch right away.
 */
export function useInvalidateCountryData() {
  const utils = api.useUtils();
  return useCallback(() => {
    const markStale = { refetchType: "none" } as const;
    void utils.countries.invalidate(undefined, markStale);
    void utils.mycountry.invalidate(undefined, markStale);
    void utils.government.invalidate(undefined, markStale);
    void utils.taxSystem.invalidate(undefined, markStale);
    void utils.economics.invalidate(undefined, markStale);
    void utils.countries.flags.resolveBatch.invalidate();
  }, [utils]);
}
