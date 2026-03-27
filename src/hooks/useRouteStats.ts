"use client";

/**
 * useRouteStats — Computes total length and stats for an array of route waypoints.
 */

import { useMemo } from "react";
import { polylineLengthKm, polylineLengthMi } from "~/lib/geo-math";

export interface RouteStats {
  lengthKm: number;
  lengthMi: number;
  waypointCount: number;
}

export function useRouteStats(waypoints: [number, number][]): RouteStats {
  return useMemo(() => {
    const lengthKm = waypoints.length >= 2 ? polylineLengthKm(waypoints) : 0;
    const lengthMi = waypoints.length >= 2 ? polylineLengthMi(waypoints) : 0;
    return {
      lengthKm,
      lengthMi,
      waypointCount: waypoints.length,
    };
  }, [waypoints]);
}
