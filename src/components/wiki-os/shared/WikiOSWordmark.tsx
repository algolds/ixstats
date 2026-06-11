import React from "react";
import { cn } from "~/lib/utils";
import IxLogoV2 from "~/app/_components/ix-logo-v2.svg";

interface WikiOSWordmarkProps {
  className?: string;
}

export function WikiOSWordmark({ className }: WikiOSWordmarkProps) {
  return (
    <h1 className={cn("wikios-brand-title", className)}>
      <img src={IxLogoV2.src} alt="IX" className="wikios-brand-title-ix" />
      <span
        style={{
          fontFamily: "var(--font-playfair)",
          fontWeight: 600,
          letterSpacing: "0.15em",
          marginLeft: "0.08em",
        }}
      >
        WIKI
      </span>
    </h1>
  );
}
