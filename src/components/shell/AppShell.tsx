"use client";

/**
 * Root page frame (src/app/layout.tsx): the navigation shell (`FacetShell`: AppSidebar / TabBar /
 * Halo island) and `<main>`, offset by `--shell-sidebar-width` and `--shell-tabbar-height` in
 * `src/styles/facet/shell.css`. Chromeless routes set `data-chromeless`.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { stripBasePath } from "~/lib/base-path";
import { isChromelessPath } from "~/lib/navigation/app-sections";
import { FacetShell } from "./FacetShell";

export interface AppShellProps {
  /** Rendered between the navigation and `<main>` (e.g. the setup redirect). */
  beforeMain?: ReactNode;
  children: ReactNode;
}

export function AppShell({ beforeMain, children }: AppShellProps) {
  const pathname = stripBasePath(usePathname() || "/");
  return (
    <div
      data-app-shell=""
      data-chromeless={isChromelessPath(pathname) ? "" : undefined}
      className="flex min-h-screen flex-col"
    >
      <FacetShell />
      {beforeMain}
      <main data-shell-main="" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
