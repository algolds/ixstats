"use client";

import { StudioApplySection } from "./StudioApplySection";
import { StudioExportSection } from "./StudioExportSection";
import { StudioNewRealmSection } from "./StudioNewRealmSection";

/** Ship: take the world out as files, put it on a realm, or start a realm from it. */
export function StudioShipTab() {
  return (
    <div className="space-y-5 p-3">
      <StudioExportSection />
      <div className="border-separator border-t pt-4">
        <StudioApplySection />
      </div>
      <div className="border-separator border-t pt-4">
        <StudioNewRealmSection />
      </div>
    </div>
  );
}
