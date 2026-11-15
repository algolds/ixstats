"use client";

import { useSyncExternalStore } from "react";

const KEY = "ixstats.play_as_user";
const EVENT = "ixstats-play-as-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The admin "play as" target user id, or "" when not impersonating. */
export function usePlayAsTarget(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
