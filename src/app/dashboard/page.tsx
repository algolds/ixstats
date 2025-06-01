// src/app/dashboard/page.tsx
import { Suspense } from "react";
import Dashboard from "./_components/Dashboard";

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--color-brand-primary)] mx-auto"></div>
        <p className="mt-4 text-[var(--color-text-muted)]">Loading IxStats...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
}

export const metadata = {
  title: "IxStats - Dashboard",
  description: "Automated Economic Statistics for Ixnay",
};