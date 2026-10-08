import { Suspense } from "react";
import type { Metadata } from "next";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export const metadata: Metadata = {
  title: "ThinkTanks - IxStats",
  description: "Collaborative groups, chats, and working notes",
};

export default function ThinktanksLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <div className="border-tint h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <div data-app="thinkpages" className="relative min-h-screen">
        <PortalTintSync />
        <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">{children}</div>
      </div>
    </Suspense>
  );
}
