"use client";

import React from "react";
import Link from "next/link";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { MyCountryNavCards } from "./MyCountryNavCards";
import { Crown, Edit } from "lucide-react";
import { Button } from "~/components/ui/button";
import { DevCountryViewSelect } from "~/components/dev";
import { createUrl } from "~/lib/url-utils";
import { usePremium } from "~/hooks/usePremium";

interface MyCountryCompactHeaderProps {
  country: {
    name: string;
    id: string;
  };
  flagUrl: string | null;
  currentPage?: "overview" | "executive" | "diplomacy" | "intelligence" | "defense";
}

export function MyCountryCompactHeader({
  country,
  flagUrl,
  currentPage = "overview",
}: MyCountryCompactHeaderProps) {
  const { isPremium } = usePremium();
  return (
    <div className="from-background to-background relative w-full border-b border-amber-500/20 bg-gradient-to-r via-amber-950/5 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: MyCountry Brand + Flag + Name */}
          <div className="flex items-center gap-3">
            {/* MyCountry Icon/Brand */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 px-3 py-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="hidden bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-sm font-semibold text-transparent sm:inline">
                MyCountry
              </span>
            </div>

            {/* Flag */}
            <UnifiedCountryFlag
              countryName={country.name}
              flagUrl={flagUrl}
              size="sm"
              rounded={true}
              shadow={true}
              border={true}
              className="h-8 w-8"
            />

            {/* Country Name */}
            <div className="flex flex-col">
              <h1 className="bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-lg font-bold text-transparent dark:from-amber-400 dark:to-yellow-400">
                {country.name.replace(/_/g, " ")}
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-amber-600/70 dark:text-amber-400/70">Overview</span>
                {isPremium && (
                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1 rounded uppercase tracking-wider shrink-0">
                    Premium
                  </span>
                )}
              </div>
            </div>

            {/* Editor Button */}
            <Link href={createUrl("/mycountry/editor")} className="ml-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-amber-500/30 bg-amber-500/5 text-amber-700 hover:border-amber-500/50 hover:bg-amber-500/10 dark:text-amber-300"
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit Country</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            </Link>

            {/* Dev Country View Selector (dev mode only) */}
            <DevCountryViewSelect />
          </div>

          {/* Right: Inline Nav Cards (hidden on mobile, shown on desktop) */}
          <div className="hidden md:block">
            <MyCountryNavCards currentPage={currentPage} collapsed={false} />
          </div>
        </div>

        {/* Mobile: Full Nav Cards Below */}
        <div className="mt-3 md:hidden">
          <MyCountryNavCards currentPage={currentPage} collapsed={false} />
        </div>
      </div>
    </div>
  );
}
