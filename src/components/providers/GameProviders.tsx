"use client";

import { useNotificationBadge } from "~/hooks/useLiveNotifications";
import { usePresenceHeartbeat } from "~/hooks/usePresenceHeartbeat";
import { SportsLiveHalo } from "~/components/halo/plugins/sports";

/** Signed-in-only side effects (title badge polling, presence heartbeat, live sports Halo plugin). */
export function GameSidecar() {
  useNotificationBadge({ enableTitleBadge: true });
  usePresenceHeartbeat();
  return <SportsLiveHalo />;
}
