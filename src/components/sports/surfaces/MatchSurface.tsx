import React from "react";
import { SoccerPitch } from "./SoccerPitch";
import { HockeyRink } from "./HockeyRink";
import { CircuitMap } from "./CircuitMap";
import { FootballField } from "./FootballField";

interface MatchSurfaceProps {
  sportPreset?: string | null;
  className?: string;
  circuitName?: string;
  lapCount?: number;
  children?: React.ReactNode;
}

export function MatchSurface({
  sportPreset,
  className,
  circuitName,
  lapCount,
  children,
}: MatchSurfaceProps) {
  switch (sportPreset?.toLowerCase().trim()) {
    case "hockey":
      return <HockeyRink className={className}>{children}</HockeyRink>;

    case "football":
      return <FootballField className={className}>{children}</FootballField>;

    case "f1":
      return (
        <CircuitMap className={className} circuitName={circuitName} lapCount={lapCount}>
          {children}
        </CircuitMap>
      );

    default:
      return <SoccerPitch className={className}>{children}</SoccerPitch>;
  }
}
