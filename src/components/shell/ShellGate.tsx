"use client";

/**
 * Renders `children` only under one navigation shell (the `facet-nav` flag).
 *
 * On the server and during hydration the flag is not known yet, so both variants are rendered and
 * CSS (`[data-shell-variant]` in `src/styles/facet/shell.css`, keyed off `html[data-nav]` from the
 * pre-paint script) shows the right one — no flash, no hydration mismatch. Once hydrated, the
 * inactive variant unmounts.
 *
 * ```tsx
 * <ShellGate variant="facet"><PageHeader title="Help Center" /></ShellGate>
 * <ShellGate variant="legacy"><LegacyHeader /></ShellGate>
 * ```
 */

import type { ReactNode } from "react";
import { useFacetNav } from "~/lib/navigation/use-facet-nav";

export type ShellVariant = "facet" | "legacy";

export function ShellGate({ variant, children }: { variant: ShellVariant; children: ReactNode }) {
  const { enabled, resolved } = useFacetNav();
  if (resolved && enabled !== (variant === "facet")) return null;
  return <div data-shell-variant={variant}>{children}</div>;
}
