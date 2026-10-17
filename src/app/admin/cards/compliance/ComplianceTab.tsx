"use client";
/** Compliance: one takedown queue for every card source, and licence review. */
import { useState } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { LicenceReview } from "./LicenceReview";
import { TakedownQueue } from "./TakedownQueue";

type Section = "takedowns" | "licences";

const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "takedowns", label: "Takedowns" },
  { value: "licences", label: "Licence review" },
];

export function ComplianceTab() {
  const [section, setSection] = useState<Section>("takedowns");
  return (
    <div className="space-y-6">
      <SegmentedControl
        asTabs
        aria-label="Compliance"
        value={section}
        onValueChange={setSection}
        options={SECTION_OPTIONS}
      />
      {section === "takedowns" ? <TakedownQueue /> : <LicenceReview />}
    </div>
  );
}
