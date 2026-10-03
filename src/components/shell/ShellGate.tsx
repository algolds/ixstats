/**
 * Transitional shim: the sidebar shell is the only navigation, so `variant="facet"` always renders
 * and `variant="legacy"` never does. Delete once `admin/_components/AdminSidebarLayout.tsx` and
 * `app/help/page.tsx` stop importing it.
 */

import type { ReactNode } from "react";

export function ShellGate({
  variant,
  children,
}: {
  variant: "facet" | "legacy";
  children: ReactNode;
}) {
  return variant === "facet" ? <>{children}</> : null;
}
