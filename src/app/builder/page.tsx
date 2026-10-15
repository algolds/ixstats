import { Suspense } from "react";
import { FoundingFlow } from "./_founding/FoundingFlow";

export const dynamic = "force-dynamic";

/** Founding a nation. `/mycountry/builder` and `/builder/import` redirect here. */
export default function BuilderPage() {
  return (
    <Suspense fallback={null}>
      <FoundingFlow />
    </Suspense>
  );
}
