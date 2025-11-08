"use client";

import { Crown, BarChart3, Edit, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface CountryHeaderProps {
  countryName: string;
  countryId: string;
  countrySlug?: string;
  economicTier?: string;
  populationTier?: string;
  variant?: "unified" | "standard" | "premium";
}

export function CountryHeader({
  countryName,
  countryId,
  countrySlug,
  economicTier,
  populationTier,
  variant = "unified",
}: CountryHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 p-2">
          <Crown className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{countryName}</h1>
          <p className="text-muted-foreground">National Overview & Vitality Dashboard</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={createUrl(`/countries/${countrySlug || countryId}`)}>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Public View
          </Button>
        </Link>
        <Link href={createUrl("/mycountry/editor")}>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Data
          </Button>
        </Link>
      </div>
    </div>
  );
}
