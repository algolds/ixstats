import React from "react";
import { getSportDefinition } from "~/lib/sports/definitions";
import { SoccerPitch } from "./SoccerPitch";
import { HockeyRink } from "./HockeyRink";
import { CircuitMap } from "./CircuitMap";
import { FootballField } from "./FootballField";

export interface MatchSurfaceProps {
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
  const definition = getSportDefinition(sportPreset);

  switch (definition.surfaceType) {
    case "rink":
      return (
        <HockeyRink className={className}>
          {children}
        </HockeyRink>
      );

    case "gridiron":
      return (
        <FootballField className={className}>
          {children}
        </FootballField>
      );

    case "circuit":
      return (
        <CircuitMap
          className={className}
          circuitName={circuitName}
          lapCount={lapCount}
        >
          {children}
        </CircuitMap>
      );

    case "pitch":
    default:
      return (
        <SoccerPitch className={className}>
          {children}
        </SoccerPitch>
      );
  }
}

