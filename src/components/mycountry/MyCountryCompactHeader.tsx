"use client";

import React from "react";
import Link from "next/link";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { MyCountryNavCards } from "./MyCountryNavCards";
import { Crown, Edit } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface MyCountryCompactHeaderProps {
  country: {
    name: string;
    id: string;
  };
  flagUrl: string | null;
  currentPage?: "overview" | "executive" | "diplomacy" | "intelligence" | "defense";
}

export function MyCountryCompactHeader({ country, flagUrl, currentPage = "overview" }: MyCountryCompactHeaderProps) {
  return (
    <div className="relative w-full border-b border-amber-500/20 bg-gradient-to-r from-background via-amber-950/5 to-background backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: MyCountry Brand + Flag + Name */}
          <div className="flex items-center gap-3">
            {/* MyCountry Icon/Brand */}
            <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber-500/10 to-yellow-500/10 px-3 py-2 border border-amber-500/20">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="hidden sm:inline text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
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
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-yellow-600 dark:from-amber-400 dark:to-yellow-400 bg-clip-text text-transparent">
                {country.name.replace(/_/g, " ")}
              </h1>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                Command Center
              </p>
            </div>

            {/* Editor Button */}
            <Link href="/mycountry/editor" className="ml-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 text-amber-700 dark:text-amber-300"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Edit Country</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            </Link>
          </div>

          {/* Right: Inline Nav Cards (hidden on mobile, shown on desktop) */}
          <div className="hidden md:block">
            <MyCountryNavCards
              currentPage={currentPage}
              collapsed={false}
            />
          </div>
        </div>

        {/* Mobile: Full Nav Cards Below */}
        <div className="mt-3 md:hidden">
          <MyCountryNavCards
            currentPage={currentPage}
            collapsed={false}
          />
        </div>
      </div>
    </div>
  );
}
