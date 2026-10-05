"use client";
// Admin "play as" (impersonation) state, shared with the tRPC client through localStorage.

import { useEffect, useState } from "react";
import { useNotify } from "~/hooks/useNotify";

const STORAGE_KEY = "ixstats.play_as_user";
const CHANGE_EVENT = "ixstats-play-as-change";

export function usePlayAs() {
  const notify = useNotify();
  const [activePlayAs, setActivePlayAs] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkPlayAs = () => setActivePlayAs(localStorage.getItem(STORAGE_KEY));
    checkPlayAs();
    window.addEventListener("storage", checkPlayAs);
    window.addEventListener(CHANGE_EVENT, checkPlayAs);
    return () => {
      window.removeEventListener("storage", checkPlayAs);
      window.removeEventListener(CHANGE_EVENT, checkPlayAs);
    };
  }, []);

  const handleStartPlayAs = (clerkUserId: string, nationName?: string | null) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, clerkUserId);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setActivePlayAs(clerkUserId);
    notify.success(
      "Impersonation Active",
      `Now playing as ${nationName ? `${nationName} (${clerkUserId})` : clerkUserId}. All tRPC queries & Halo will mirror this user.`
    );
  };

  const handleStopPlayAs = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setActivePlayAs(null);
    notify.info("Impersonation Stopped", "Restored administrative identity.");
  };

  return { activePlayAs, handleStartPlayAs, handleStopPlayAs };
}
