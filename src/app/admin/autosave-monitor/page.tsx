// src/app/admin/autosave-monitor/page.tsx
// Admin page for autosave system monitoring

import { AutosaveMonitoringDashboard } from "../_components/AutosaveMonitoringDashboard";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Autosave Monitor | Admin Console",
  description: "Monitor autosave system health and performance",
};

export default function AutosaveMonitorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <AutosaveMonitoringDashboard />
    </div>
  );
}
