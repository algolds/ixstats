"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export default function MyClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="labs" className="contents">
      <PortalTintSync />
      <AuthenticationGuard redirectPath="/myclub">{children}</AuthenticationGuard>
    </div>
  );
}
