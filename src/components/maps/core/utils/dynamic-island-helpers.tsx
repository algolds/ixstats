"use client";

import { Globe, MapPin, Hexagon, Bank as Landmark } from "iconoir-react";
import { useFlag } from "~/hooks/useUnifiedFlags";

export const getGreeting = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};
export const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  country: { icon: Globe, label: "Countries" },
  city: { icon: MapPin, label: "Cities" },
  subdivision: { icon: Hexagon, label: "Regions" },
  poi: { icon: Landmark, label: "Points of interest" },
};

export const SPRING = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };
export const SPRING_SOFT = { type: "spring" as const, stiffness: 300, damping: 28, mass: 1 };

/** Tiny inline flag that resolves async via the unified flag hook, in the realm the map shows. */
export function FlagIcon({ name, realm }: { name: string; realm?: string }) {
  const { flagUrl } = useFlag(name, realm);
  if (!flagUrl) return null;
  return (
    <img
      src={flagUrl}
      alt=""
      className="border-separator h-3.5 w-5 shrink-0 rounded-xs border object-cover"
    />
  );
}
