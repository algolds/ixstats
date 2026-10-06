// src/app/labs/layout.tsx
// Labs tint scope: Labs uses the sky `maps` tint (Onoma's brand is blue), as in
// src/lib/navigation/app-sections.ts. PortalTintSync keeps dialogs, sheets and menus on it.
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
    <div data-app="maps" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
