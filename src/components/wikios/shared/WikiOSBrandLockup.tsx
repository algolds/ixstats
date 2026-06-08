import React from "react";
import { cn } from "~/lib/utils";
import { WikiOSWordmark } from "./WikiOSWordmark";
import {
  DynamicIslandEffects,
  DYNAMIC_ISLAND_STYLE,
  DYNAMIC_ISLAND_BORDER_CLASS,
} from "~/app/builder/components/glass";

interface WikiOSBrandLockupProps {
  className?: string;
}

export function WikiOSBrandLockup({ className }: WikiOSBrandLockupProps) {
  return (
    <div className={cn("wikios-brand-lockup", className)}>
      <div
        className={cn("wikios-brand-logo-container", DYNAMIC_ISLAND_BORDER_CLASS)}
        style={DYNAMIC_ISLAND_STYLE}
      >
        {/* Dynamic Island refraction glow, edge highlights, and pulse shimmer */}
        <DynamicIslandEffects glowOpacity={0.6} showGlow={true} showShimmer={true} />
        
        <img
          src="https://ixwiki.com/data/IxWiki_4.svg"
          alt="IxWiki"
          className="wikios-brand-logo relative z-10"
        />
        <div className="wikios-logo-sheen relative z-10" />
      </div>
      <div className="wikios-brand-text">
        <WikiOSWordmark />
        <p className="wikios-brand-subtitle">Worldbuilding Encyclopedia</p>
      </div>
    </div>
  );
}

