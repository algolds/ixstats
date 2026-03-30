// src/components/wikios/reader/IxWorldEmbed.tsx
// Inline IxWorld map embed for wiki articles.
// Shows an interactive map centered on a country.

"use client";

import dynamic from "next/dynamic";

interface IxWorldEmbedProps {
  /** Country ID to center the map on */
  countryId: string;
  /** Height class (Tailwind) */
  height?: string;
  /** Show neighboring countries */
  showNeighbors?: boolean;
  /** Show city markers */
  showCities?: boolean;
  /** Allow interaction (zoom/pan) */
  interactive?: boolean;
}

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="wikios-ixworld-loading">
        <div className="wikios-loading-spinner" style={{ width: 20, height: 20 }} />
        <span>Loading map...</span>
      </div>
    ),
  }
);

export function IxWorldEmbed({
  countryId,
  height = "h-64",
  showNeighbors = true,
  showCities = true,
  interactive = true,
}: IxWorldEmbedProps) {
  return (
    <div className="wikios-ixworld-embed glass-hierarchy-child">
      <CountryMapEmbed
        countryId={countryId}
        height={height}
        showNeighbors={showNeighbors}
        showCities={showCities}
        interactive={interactive}
      />
      <div className="wikios-ixworld-footer">
        <span className="wikios-ixworld-badge">IxWorld Map</span>
      </div>
    </div>
  );
}
