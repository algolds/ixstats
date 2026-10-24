"use client";

import { ViewTransition, type ReactNode } from "react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";

/**
 * An element that morphs between two pages when both render it under the same `name`, such as a realm's map face
 * from its atlas card into its page header. Under reduced motion the children render alone, so nothing animates.
 */
export function SharedElement({ name, children }: { name: string; children: ReactNode }) {
  const reducedMotion = useFacetReducedMotion();
  if (reducedMotion) return <>{children}</>;
  return <ViewTransition name={name}>{children}</ViewTransition>;
}
