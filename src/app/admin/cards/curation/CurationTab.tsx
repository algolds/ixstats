"use client";
/** Curation: the review queue (imports wait here before packs) and players' free suggestions. */
import { useState } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ReviewQueue } from "./ReviewQueue";
import { SuggestionsList } from "./SuggestionsList";

type Section = "review" | "suggestions";

const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "review", label: "Review queue" },
  { value: "suggestions", label: "Suggestions" },
];

export function CurationTab() {
  const [section, setSection] = useState<Section>("review");
  return (
    <div className="space-y-6">
      <SegmentedControl
        asTabs
        aria-label="Curation"
        value={section}
        onValueChange={setSection}
        options={SECTION_OPTIONS}
      />
      {section === "review" ? <ReviewQueue /> : <SuggestionsList />}
    </div>
  );
}
