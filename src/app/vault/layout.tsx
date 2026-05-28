"use client";

import { usePathname } from "next/navigation";
import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { getSectionFromPathname } from "~/components/vault/VaultSidebarNav";

function VaultLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeSection = getSectionFromPathname(pathname);

  return <VaultSidebarLayout activeSection={activeSection}>{children}</VaultSidebarLayout>;
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthenticationGuard redirectPath="/vault">
      <VaultLayoutInner>{children}</VaultLayoutInner>
    </AuthenticationGuard>
  );
}
