"use client";

import { useRouter } from "next/navigation";
import { VaultDashboardSection } from "~/components/vault/sections/VaultDashboardSection";
import { withBasePath } from "~/lib/base-path";
import type { VaultSection } from "~/components/vault/VaultSidebarNav";

export default function VaultPage() {
  const router = useRouter();

  const handleNavigate = (section: VaultSection) => {
    const href = section === "dashboard" ? "/vault" : `/vault/${section}`;
    router.push(withBasePath(href));
  };

  return <VaultDashboardSection onNavigate={handleNavigate} />;
}
