"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export default function MyLeagueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="labs" className="contents">
      <PortalTintSync />
      <AuthenticationGuard redirectPath="/myleague">{children}</AuthenticationGuard>
    </div>
  );
}
