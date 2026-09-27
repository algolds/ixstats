"use client";

import { useNotificationBadge } from "~/hooks/useLiveNotifications";
import { SportsLiveHalo } from "~/components/halo/plugins/sports";

/** Signed-in-only side effects (title badge polling, live sports Halo plugin). */
export function GameSidecar() {
  useNotificationBadge({ enableTitleBadge: true });
  return <SportsLiveHalo />;
}
