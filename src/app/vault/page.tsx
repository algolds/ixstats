"use client";

import { useRouter } from "next/navigation";
import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";
import type { VaultSection } from "~/components/vault/vault-sections";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export default function VaultPage() {
  const router = useRouter();

  const handleNavigate = (section: VaultSection) => {
    const href = section === "dashboard" ? "/vault" : `/vault/${section}`;
    router.push(href);
  };

  return (
    <>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Vault" className="px-0" />
      <VaultDashboardSection onNavigate={handleNavigate} />
    </>
  );
}
