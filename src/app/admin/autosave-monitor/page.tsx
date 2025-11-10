// src/app/admin/autosave-monitor/page.tsx
// Admin page for autosave system monitoring

import { AutosaveMonitoringDashboard } from "../_components/AutosaveMonitoringDashboard";

export const metadata = {
  title: "Autosave Monitor | Admin Console",
  description: "Monitor autosave system health and performance",
};

export default function AutosaveMonitorPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <AutosaveMonitoringDashboard />
    </div>
  );
}
