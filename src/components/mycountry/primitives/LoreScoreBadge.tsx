"use client";

/**
 * LoreScoreBadge — Compact display of a country's Lore Score.
 *
 * Shows the score (0-100) with tier label and color.
 * Creates a visible incentive to invest in worldbuilding.
 *
 * NOTE: The `api.countries.getLoreScore` procedure does not yet exist.
 * This badge returns null until the endpoint is implemented.
 */

import { memo } from "react";

interface LoreScoreBadgeProps {
  countryId: string;
  variant?: "compact" | "detailed";
}

export const LoreScoreBadge = memo(function LoreScoreBadge({
  countryId: _countryId,
  variant: _variant = "compact",
}: LoreScoreBadgeProps) {
  // getLoreScore procedure not yet implemented — badge is hidden until endpoint exists
  return null;
});
