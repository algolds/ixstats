"use client";

import { useState, useEffect } from "react";

/**
 * Custom hook to read and reactively sync wiki preferences stored in localStorage.
 * Listens to storage events and a custom 'wikios-settings-changed' event triggered
 * when toggled from the settings panel.
 */
export function useWikiSetting(key: string, defaultValue: boolean): boolean {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const readValue = () => {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          setValue(stored === "true");
        } else {
          setValue(defaultValue);
        }
      } catch {
        setValue(defaultValue);
      }
    };

    // Read initial value
    readValue();

    // Listen to local changes in the same window/tab
    window.addEventListener("wikios-settings-changed", readValue);
    // Listen to changes from other tabs/windows
    window.addEventListener("storage", readValue);

    return () => {
      window.removeEventListener("wikios-settings-changed", readValue);
      window.removeEventListener("storage", readValue);
    };
  }, [key, defaultValue]);

  return value;
}
