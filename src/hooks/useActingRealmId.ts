"use client";

import { useNationClock } from "~/hooks/useNationClock";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";

/**
 * The realm of the nation the viewer acts for: the nation in view's (MyCountry's `NationClockProvider`), else the
 * viewer's active nation's. Pickers for country-to-country actions offer only nations of this realm (the
 * cross-realm rule, `~/lib/realms/same-realm`). Undefined while it loads.
 */
export function useActingRealmId(): string | undefined {
  const inView = useNationClock()?.realmId;
  const viewer = useViewerRealmId();
  return inView ?? viewer;
}
