"use client";
/** Curation: the review queue (imports wait here before packs), players' free suggestions and category review. */
import { useState, type ComponentType } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { CategoryReviewQueue } from "./CategoryReviewQueue";
import { ReviewQueue } from "./ReviewQueue";
import { SuggestionsList } from "./SuggestionsList";

type Section = "review" | "suggestions" | "categories";

const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "review", label: "Review queue" },
  { value: "suggestions", label: "Suggestions" },
  { value: "categories", label: "Categories" },
];

const SECTIONS: Record<Section, ComponentType> = {
  review: ReviewQueue,
  suggestions: SuggestionsList,
  categories: CategoryReviewQueue,
};

export function CurationTab() {
  const [section, setSection] = useState<Section>("review");
  const Shown = SECTIONS[section];
  return (
    <div className="space-y-6">
      <SegmentedControl
        asTabs
        aria-label="Curation"
        value={section}
        onValueChange={setSection}
        options={SECTION_OPTIONS}
      />
      <Shown />
    </div>
  );
}
