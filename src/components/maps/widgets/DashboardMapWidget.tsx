"use client";

/**
 * DashboardMapWidget - Compact map for the Dashboard sidebar.
 *
 * When the user has a country, shows a zoomed-in country map using
 * CountryMapEmbed (10-50KB data vs 17.8MB for the full world map).
 * Otherwise shows a placeholder prompting them to select a country.
 * Clicking "Full map" opens the /maps page.
 */

import { Globe, MapPin } from "lucide-react";
import { CountryMapEmbed } from "~/components/maps/widgets/CountryMapEmbed";
import { createUrl } from "~/lib/url-utils";

interface DashboardMapWidgetProps {
  userCountryId?: string;
  className?: string;
}

export function DashboardMapWidget({
  userCountryId,
  className = "",
}: DashboardMapWidgetProps) {
  return (
    <div
      className={`glass-hierarchy-child overflow-hidden rounded-xl border border-blue-500/15 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {userCountryId ? "Your Territory" : "World Map"}
          </span>
        </div>
        <a
          href={createUrl("/maps")}
          className="text-[10px] text-blue-500 hover:text-blue-600"
        >
          Full map →
        </a>
      </div>

      {/* Map — lightweight country embed or placeholder */}
      <div className="h-56">
        {userCountryId ? (
          <CountryMapEmbed
            countryId={userCountryId}
            height="h-56"
            interactive={false}
            showNeighbors={true}
            showCities={true}
            boundsPadding={60}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/50">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Select a country to view map
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
