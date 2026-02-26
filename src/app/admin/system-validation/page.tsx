"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { SystemValidationDashboard } from "../_components/SystemValidationDashboard";
import { ShieldCheck } from "lucide-react";

export default function SystemValidationPage() {
  usePageTitle({ title: "Admin - System Validation" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={ShieldCheck}
        title="System Validation"
        description="Comprehensive health checks for all platform subsystems"
      />
      <SystemValidationDashboard />
    </div>
  );
}
