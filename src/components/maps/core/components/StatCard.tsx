"use client";

import React from "react";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onClick?: () => void;
}

/** A labelled figure inside a map panel: an opaque Facet card (the panel itself is the glass). */
export function StatCard({ icon: Icon, label, value, onClick }: StatCardProps) {
  const body = (
    <>
      <Eyebrow className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
        {onClick && <ChevronRight className="ml-auto h-3 w-3 opacity-60" aria-hidden />}
      </Eyebrow>
      <div className="text-foreground mt-0.5 text-sm font-semibold">{value}</div>
    </>
  );

  return (
    <FacetCard surface="solid" className="rounded-lg">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="hover:bg-accent focus-visible:ring-ring w-full rounded-lg px-3 py-2 text-left transition-[background-color,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]"
        >
          {body}
        </button>
      ) : (
        <div className="px-3 py-2">{body}</div>
      )}
    </FacetCard>
  );
}
