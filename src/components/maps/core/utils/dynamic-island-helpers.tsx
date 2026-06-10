"use client";

import { useState, useEffect } from "react";
import { Globe, MapPin, Hexagon, Landmark } from "lucide-react";
import { flagService } from "~/lib/flag-service";

export const getGreeting = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

export const getTimeDisplay = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

export const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  country: { icon: Globe, label: "Countries" },
  city: { icon: MapPin, label: "Cities" },
  subdivision: { icon: Hexagon, label: "Regions" },
  poi: { icon: Landmark, label: "Points of Interest" },
};

export const SPRING = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };
export const SPRING_SOFT = { type: "spring" as const, stiffness: 300, damping: 28, mass: 1 };

/** Tiny inline flag that resolves async via the unified flag service. */
export function FlagIcon({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(() => flagService.getCachedFlagUrl(name));
  useEffect(() => {
    if (url) return;
    let mounted = true;
    flagService.getFlagUrl(name).then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [name, url]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="h-3.5 w-5 shrink-0 rounded-[2px] border border-white/10 object-cover"
    />
  );
}
