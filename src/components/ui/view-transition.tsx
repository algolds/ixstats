"use client";

import { ViewTransition, type ReactNode } from "react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";

/**
 * Sanitised `view-transition-name` for an element shared between a country's public profile and
 * MyCountry (`country-face-<slug>`, `country-flag-<slug>`, `country-title-<slug>`).
 */
export function countryTransitionName(
  part: "face" | "flag" | "title",
  slug: string | null | undefined
): string | null {
  const clean = slug?.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  return clean ? `country-${part}-${clean}` : null;
}

/**
 * An element that morphs between two pages when both render it under the same `name`, such as a realm's map face
 * from its atlas card into its page header. Under reduced motion the children render alone, so nothing animates.
 */
export function SharedElement({
  name,
  children,
}: {
  name: string | null | undefined;
  children: ReactNode;
}) {
  const reducedMotion = useFacetReducedMotion();
  if (reducedMotion || !name || !ViewTransition) return <>{children}</>;
  return <ViewTransition name={name}>{children}</ViewTransition>;
}
