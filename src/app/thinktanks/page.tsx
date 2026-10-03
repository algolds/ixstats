import React, { Suspense } from "react";
import { type Metadata } from "next";
import { ThinktankWorkspace } from "~/components/thinktanks/ThinktankWorkspace";

export const metadata: Metadata = {
  title: "ThinkTanks | IxStates",
  description:
    "Join ThinkTanks, collaborate on working papers, publish group thinks and join diplomatic discussions.",
};

export default function ThinktanksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-footnote text-label-secondary">Loading ThinkTanks...</p>
          </div>
        </div>
      }
    >
      <ThinktankWorkspace />
    </Suspense>
  );
}
