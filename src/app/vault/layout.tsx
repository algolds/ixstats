"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="vault" className="contents">
      <PortalTintSync />
      <AuthenticationGuard redirectPath="/vault">
        <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:py-6 md:py-8">
          {children}
        </div>
      </AuthenticationGuard>
    </div>
  );
}
