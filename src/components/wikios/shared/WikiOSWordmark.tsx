import React from "react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface WikiOSWordmarkProps {
  className?: string;
}

export function WikiOSWordmark({ className }: WikiOSWordmarkProps) {
  return (
    <h1 className={cn("wikios-brand-title", className)}>
      <img
        src={withBasePath("/ix-logo-v2.svg")}
        alt="IX"
        className="wikios-brand-title-ix"
      />
      <span
        style={{
          fontFamily: "var(--font-playfair)",
          fontWeight: 600,
          letterSpacing: "0.15em",
          marginLeft: "-0.03em",
        }}
      >
        WIKI
      </span>
    </h1>
  );
}
