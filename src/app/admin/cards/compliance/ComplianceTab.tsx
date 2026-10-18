"use client";
/** Compliance: one takedown queue for every card source, licence review, and reported inscriptions. */
import { useState } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { InscriptionReports } from "./InscriptionReports";
import { LicenceReview } from "./LicenceReview";
import { TakedownQueue } from "./TakedownQueue";

const SECTION_BODY = {
  takedowns: TakedownQueue,
  licences: LicenceReview,
  inscriptions: InscriptionReports,
} as const;
type Section = keyof typeof SECTION_BODY;

const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "takedowns", label: "Takedowns" },
  { value: "licences", label: "Licence review" },
  { value: "inscriptions", label: "Inscriptions" },
];

export function ComplianceTab() {
  const [section, setSection] = useState<Section>("takedowns");
  const Body = SECTION_BODY[section];
  return (
    <div className="space-y-6">
      <SegmentedControl
        asTabs
        aria-label="Compliance"
        value={section}
        onValueChange={setSection}
        options={SECTION_OPTIONS}
      />
      <Body />
    </div>
  );
}
