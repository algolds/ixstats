/**
 * Utilities for formatting and normalizing membership tiers across IxStates.
 */

export interface TierInfo {
  label: string;
  isPremium: boolean;
  badgeClass: string;
}

export function formatMembershipTier(tier?: string | null): TierInfo {
  if (!tier) {
    return {
      label: "Citizen",
      isPremium: false,
      badgeClass: "border-border/60 bg-muted/60 text-muted-foreground",
    };
  }

  const normalized = tier.toLowerCase().trim();
  const isPremium = normalized === "mycountry_premium" || normalized === "premium" || normalized === "executive";

  if (isPremium) {
    return {
      label: "Premium",
      isPremium: true,
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: normalized === "basic" ? "Citizen" : tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " "),
    isPremium: false,
    badgeClass: "border-border/60 bg-muted/60 text-muted-foreground",
  };
}
