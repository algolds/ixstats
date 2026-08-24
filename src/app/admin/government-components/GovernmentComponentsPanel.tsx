// src/app/admin/government-components/GovernmentComponentsPanel.tsx
"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AtomicComponentManager } from "~/components/admin/atomic-components/AtomicComponentManager";

export function GovernmentComponentsPanel() {
  usePageTitle({ title: "Admin - Government Components" });
  return <AtomicComponentManager domain="government" />;
}

export default GovernmentComponentsPanel;
