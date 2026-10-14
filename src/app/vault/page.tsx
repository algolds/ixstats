"use client";

import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export default function VaultPage() {
  return (
    <>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Vault" className="px-0" />
      <VaultDashboardSection />
    </>
  );
}
