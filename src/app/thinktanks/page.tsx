import React, { Suspense } from "react";
import { type Metadata } from "next";
import { ThinktankWorkspace } from "~/components/thinktanks/ThinktankWorkspace";

export const metadata: Metadata = {
  title: "ThinkTanks — Academic Groups & Collaborative Research | IxStates",
  description: "Join institutional ThinkTanks, collaborate on working papers, publish group thinks, and engage in real-time diplomatic deliberations.",
};

export default function ThinktanksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-muted-foreground">Loading ThinkTanks...</p>
          </div>
        </div>
      }
    >
      <ThinktankWorkspace />
    </Suspense>
  );
}
