// src/app/dashboard/page.tsx
import { Suspense } from "react";
import IxStatsDashboard from "~/app/_components/ixstats-dashboard";

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading IxStats Dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <IxStatsDashboard />
    </Suspense>
  );
}

export const metadata = {
  title: "IxStats - Dashboard",
  description: "Automated Economic Statistics for Ixnay",
};