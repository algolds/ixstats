import { Suspense } from "react";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ThinkTanks - IxStats",
  description: "Collaborative groups, chats, and working notes",
};

export default function ThinktanksLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <div className="relative min-h-screen">
        <DashboardSidebarLayout disableCollapse={true}>{children}</DashboardSidebarLayout>
      </div>
    </Suspense>
  );
}
