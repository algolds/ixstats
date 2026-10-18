import { Suspense } from "react";
import { FoundingFlow } from "./_founding/FoundingFlow";

export const dynamic = "force-dynamic";

/** Founding a nation; `?import=1` opens the wiki import sheet. */
export default function BuilderPage() {
  return (
    <Suspense fallback={null}>
      <FoundingFlow />
    </Suspense>
  );
}
