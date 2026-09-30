"use client";

import { Crown, StatsReport as BarChart3, EditPencil as Edit } from "iconoir-react";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { createUrl } from "~/lib/utils";

interface CountryHeaderProps {
  countryName: string;
  countryId: string;
  countrySlug?: string;
  economicTier?: string;
  populationTier?: string;
  variant?: "unified" | "standard" | "premium";
}

export function CountryHeader({ countryName, countryId, countrySlug }: CountryHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <Crown className="h-6 w-6 shrink-0 text-amber-500" />
        <div>
          <h1 className="text-foreground text-2xl font-semibold">{countryName}</h1>
          <p className="text-muted-foreground">National Overview & Vitality Dashboard</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={createUrl(`/countries/${countrySlug || countryId}`)}>
            <BarChart3 className="h-4 w-4" />
            Public View
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={createUrl("/mycountry/editor")}>
            <Edit className="h-4 w-4" />
            Edit Data
          </Link>
        </Button>
      </div>
    </div>
  );
}
