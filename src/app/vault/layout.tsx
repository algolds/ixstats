"use client";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="vault" className="contents">
      <PortalTintSync />
      <AuthenticationGuard redirectPath="/vault">
        <VaultSidebarLayout>{children}</VaultSidebarLayout>
      </AuthenticationGuard>
    </div>
  );
}
