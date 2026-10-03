// src/app/labs/layout.tsx
// Labs tint scope: Labs uses the sky `maps` tint (Onoma's brand is blue), as in
// src/lib/navigation/app-sections.ts. PortalTintSync keeps dialogs, sheets and menus on it.

import type { ReactNode } from "react";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export default function LabsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app="maps" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
