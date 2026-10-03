import { useEffect, useState } from "react";

/**
 * The active section of a single-page router. It starts from the URL's `section`/`tab` param and
 * follows later changes to that param, but only when the param itself changes: an in-app tab
 * switch updates state first and the URL a moment later, and must not be reverted to the stale
 * param in between.
 */
export function useUrlSyncedSection<T extends string>(urlSection: T | null, fallback: T) {
  const [section, setSection] = useState<T>(urlSection || fallback);

  useEffect(() => {
    if (urlSection) setSection(urlSection);
  }, [urlSection]);

  return [section, setSection] as const;
}
