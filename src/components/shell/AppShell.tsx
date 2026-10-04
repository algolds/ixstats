"use client";

/**
 * Root page frame (src/app/layout.tsx): the navigation shell (`FacetShell`: AppSidebar / TabBar /
 * Halo island) and `<main>`, offset by `--shell-sidebar-width` and `--shell-tabbar-height` in
 * `src/styles/facet/shell.css`. The root paints the canvas (`facet-canvas`) in the current app's
 * tint via `data-app`; chromeless routes set `data-chromeless` and get no wash.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { stripBasePath } from "~/lib/base-path";
import { getAppForPath, getTintForPath, isChromelessPath } from "~/lib/navigation/app-sections";
import { cn } from "~/lib/utils/cn";
import { FacetShell } from "./FacetShell";

interface AppShellProps {
  /** Rendered between the navigation and `<main>` (e.g. the setup redirect). */
  beforeMain?: ReactNode;
  children: ReactNode;
}

export function AppShell({ beforeMain, children }: AppShellProps) {
  const pathname = stripBasePath(usePathname() || "/");
  const chromeless = isChromelessPath(pathname);
  return (
    <div
      data-app-shell=""
      data-app={getTintForPath(getAppForPath(pathname), undefined)}
      data-chromeless={chromeless ? "" : undefined}
      className={cn("flex min-h-screen flex-col", !chromeless && "facet-canvas")}
    >
      <FacetShell />
      {beforeMain}
      <main data-shell-main="" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
