// src/app/labs/layout.tsx
// Labs tint scope: uranium glass, the `labs` tint, as in src/lib/navigation/app-sections.ts.
// Onoma sets its own azure inside it (onoma/onoma-tint.ts). PortalTintSync keeps dialogs, sheets
// and menus on the scope.
//
// Server gate (SL-27): Labs pages render only for the people the navigation shows Labs to
// (src/lib/navigation/labs-gate.ts). Signed-out visitors go to sign-in; anyone else gets a 404.

import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { PortalTintSync } from "~/components/providers/PortalTintSync";
import { getLabsAccess } from "~/lib/auth/labs-access.server";

export default async function LabsLayout({ children }: { children: ReactNode }) {
  const access = await getLabsAccess();
  if (access === "signed-out") redirect("/sign-in");
  if (access === "denied") notFound();

  return (
    <div data-app="labs" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
