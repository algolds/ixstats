"use client";

import React from "react";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { Stat } from "~/components/ui/stat";
import { FacetCard } from "~/components/ui/facet-container";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onClick?: () => void;
}

/**
 * A labelled figure inside a map panel: a `Stat` on an inset (the panel itself is the glass).
 * With `onClick` the inset is pressable (hover wash, focus ring, Enter/Space) and shows a chevron.
 */
export function StatCard({ icon: Icon, label, value, onClick }: StatCardProps) {
  return (
    <FacetCard variant="inset" padding="none" onClick={onClick} className="px-3 py-2">
      <Stat size="sm" label={label} value={value} icon={<Icon className="size-3.5" />} />
      {onClick && (
        <ChevronRight
          aria-hidden
          className="text-label-secondary absolute top-2 right-2 size-3.5 opacity-60"
        />
      )}
    </FacetCard>
  );
}
