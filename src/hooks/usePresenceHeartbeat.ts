"use client";
/**
 * Online status heartbeat (SL-4). While a signed-in tab is visible it calls `users.heartbeat`
 * once a minute (and when the tab becomes visible again); the server keeps the last time in
 * Redis or memory (src/server/shared/presence.ts). Whether anyone sees it is the user's
 * "Online status" privacy setting, applied on the server.
 */
import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";

const INTERVAL_MS = 60_000;

export function usePresenceHeartbeat(enabled = true) {
  const { mutate } = api.users.heartbeat.useMutation();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSent.current < INTERVAL_MS - 5_000) return;
      lastSent.current = now;
      mutate();
    };
    beat();
    const timer = window.setInterval(beat, INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled, mutate]);
}
