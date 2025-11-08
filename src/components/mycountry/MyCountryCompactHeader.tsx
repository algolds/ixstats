"use client";

import React from "react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { MyCountryNavCards } from "./MyCountryNavCards";
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
    <div className="relative w-full border-b border-border/40 bg-gradient-to-r from-background via-background/95 to-background backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: Flag + Name + Subtitle */}
          <div className="flex items-center gap-3">
            <UnifiedCountryFlag
              countryName={country.name}
              flagUrl={flagUrl}
              size="sm"
              rounded={true}
              shadow={true}
              border={true}
              className="h-8 w-8"
            />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-foreground">
                {country.name.replace(/_/g, " ")}
              </h1>
              <p className="text-xs text-muted-foreground">
                MyCountry
              </p>
            </div>
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
