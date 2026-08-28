"use client";
// src/app/admin/economic-components/EconomicComponentsPanel.tsx

import { usePageTitle } from "~/hooks/usePageTitle";
import { AtomicComponentManager } from "~/components/admin/atomic-components/AtomicComponentManager";

export function EconomicComponentsPanel() {
  usePageTitle({ title: "Admin - Economic Components" });
  return <AtomicComponentManager domain="economy" />;
}

export default EconomicComponentsPanel;
