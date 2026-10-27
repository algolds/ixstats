"use client";

import { useEffect, useState } from "react";

/**
 * Reads a boolean wiki preference from localStorage and follows it live: the settings controls
 * (Halo and /settings) dispatch `wikios-settings-changed` in this tab, and `storage` covers other tabs.
 */
export function useWikiSetting(key: string, defaultValue: boolean): boolean {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem(key);
        setValue(stored === null ? defaultValue : stored === "true");
      } catch {
        setValue(defaultValue);
      }
    };

    read();
    window.addEventListener("wikios-settings-changed", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("wikios-settings-changed", read);
      window.removeEventListener("storage", read);
    };
  }, [key, defaultValue]);

  return value;
}
