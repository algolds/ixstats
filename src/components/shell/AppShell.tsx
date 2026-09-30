"use client";

/**
 * Root page frame (src/app/layout.tsx): picks the navigation shell by the `facet-nav` flag.
 *
 * - Flag off (default): the legacy top navigation bar (`legacyNav`), exactly as before.
 * - Flag on: `FacetShell` (AppSidebar / TabBar / Halo island); `<main>` is offset by
 *   `--shell-sidebar-width` and `--shell-tabbar-height` in `src/styles/facet/shell.css`.
 *
 * Both are in the server HTML; CSS keyed off `html[data-nav]` shows one before first paint and the
 * other unmounts after hydration (`ShellGate`). Chromeless routes set `data-chromeless`.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { stripBasePath } from "~/lib/base-path";
import { isChromelessPath } from "~/lib/navigation/app-sections";
import { ShellGate } from "./ShellGate";
import { FacetShell } from "./FacetShell";

export interface AppShellProps {
  /** The legacy navigation (top bar + scroll modes), rendered when the flag is off. */
  legacyNav: ReactNode;
  /** Rendered between the navigation and `<main>` (e.g. the setup redirect). */
  beforeMain?: ReactNode;
  children: ReactNode;
}

export function AppShell({ legacyNav, beforeMain, children }: AppShellProps) {
  const pathname = stripBasePath(usePathname() || "/");
  return (
    <div
      data-app-shell=""
      data-chromeless={isChromelessPath(pathname) ? "" : undefined}
      className="flex min-h-screen flex-col"
    >
      <ShellGate variant="legacy">{legacyNav}</ShellGate>
      <ShellGate variant="facet">
        <FacetShell />
      </ShellGate>
      {beforeMain}
      <main data-shell-main="" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
