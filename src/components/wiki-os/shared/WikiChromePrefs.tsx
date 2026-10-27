"use client";
// src/components/wiki-os/shared/WikiChromePrefs.tsx
// The wiki chrome's preferences as the server read them from the request's cookies
// (see lib/wiki-os/chrome-prefs.ts): what a first paint should look like.

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CHROME_PREFS, type WikiChromePrefs } from "~/lib/wiki-os/chrome-prefs";

const WikiChromePrefsContext = createContext<WikiChromePrefs>(DEFAULT_CHROME_PREFS);

export function WikiChromePrefsProvider({
  prefs,
  children,
}: {
  prefs: WikiChromePrefs;
  children: ReactNode;
}) {
  return (
    <WikiChromePrefsContext.Provider value={prefs}>{children}</WikiChromePrefsContext.Provider>
  );
}

export const useWikiChromePrefs = (): WikiChromePrefs => useContext(WikiChromePrefsContext);
