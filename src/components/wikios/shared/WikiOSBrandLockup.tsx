import React from "react";
import { cn } from "~/lib/utils";
import { WikiOSWordmark } from "./WikiOSWordmark";

interface WikiOSBrandLockupProps {
  className?: string;
}

export function WikiOSBrandLockup({ className }: WikiOSBrandLockupProps) {
  return (
    <div className={cn("wikios-brand-lockup", className)}>
      <div className="wikios-brand-logo-container">
        <img
          src="https://ixwiki.com/data/IxWiki_4.svg"
          alt="IxWiki"
          className="wikios-brand-logo"
        />
        <div className="wikios-logo-sheen" />
      </div>
      <div className="wikios-brand-text">
        <WikiOSWordmark />
        <p className="wikios-brand-subtitle">Worldbuilding Encyclopedia</p>
      </div>
    </div>
  );
}
