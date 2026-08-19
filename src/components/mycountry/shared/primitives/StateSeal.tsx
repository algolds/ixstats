"use client";

import React from "react";
import { Crown, Church, Cog, Shield, Star, Landmark } from "lucide-react";
import { cn } from "~/lib/utils";

export const SEAL_STYLE = `
.seal-shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 48% 52% 47% 53% / 52% 47% 53% 48%;
  background: linear-gradient(115deg, transparent 42%, rgba(255,246,214,0.32) 50%, transparent 58%);
  mix-blend-mode: screen;
  opacity: 0;
  animation: sealSheen 7s ease-in-out infinite;
  pointer-events: none;
}
@keyframes sealSheen {
  0%, 74%, 100% { opacity: 0; transform: translateX(-28%); }
  84% { opacity: 0.85; transform: translateX(28%); }
}
@media (prefers-reduced-motion: reduce) {
  .seal-shimmer::after { animation: none; }
}
`;

export function regimeIcon(gt?: string) {
  const g = (gt ?? "").toLowerCase();
  if (/monarch|kingdom|empire|imperial|royal|crown|principal|duchy|tsar|sultan/.test(g))
    return Crown;
  if (/theocra|cleric|divine|holy|papal|ecclesi|caliph/.test(g)) return Church;
  if (/technocr|meritocr|cybernet/.test(g)) return Cog;
  if (/dictat|authorit|junta|military|autocrac|totalit|despot/.test(g)) return Shield;
  if (
    /republic|democr|parliament|president|federa|confedera|commonwealth|council|senate|union/.test(
      g
    )
  )
    return Star;
  return Landmark;
}

export const TIER_PIPS: Record<string, number> = {
  Impoverished: 1,
  Developing: 2,
  Emerging: 2,
  Developed: 3,
  Healthy: 3,
  Advanced: 4,
  Strong: 4,
  "Very Strong": 5,
  Extravagant: 5,
};

interface StateSealProps {
  flagUrl?: string | null;
  governmentType?: string;
  tier?: string;
  size?: number;
  showPips?: boolean;
  className?: string;
}

export function StateSeal({
  flagUrl,
  governmentType,
  tier,
  size = 76,
  showPips = true,
  className,
}: StateSealProps) {
  const Glyph = regimeIcon(governmentType);
  const pips = TIER_PIPS[tier ?? ""] ?? 3;
  const flag = flagUrl && /^(https?:|\/|data:)/.test(flagUrl) ? flagUrl : undefined;
  const disc = Math.round(size * 0.64);
  const waxRadius = "48% 52% 47% 53% / 52% 47% 53% 48%";

  return (
    <div
      className={cn("seal-shimmer relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <style dangerouslySetInnerHTML={{ __html: SEAL_STYLE }} />
      {/* wax body */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: waxRadius,
          background:
            "radial-gradient(circle at 38% 30%, #e2ad4a, #bd872f 46%, #8a5a1e 78%, #5f3d14)",
          boxShadow:
            "inset 0 2px 3px rgba(255,236,190,0.5), inset 0 -4px 8px rgba(58,30,0,0.55), 0 4px 14px rgba(0,0,0,0.45)",
        }}
      />
      {/* flag disc pressed into the wax (signet) */}
      <div
        className="absolute grid place-items-center"
        style={{
          top: (size - disc) / 2,
          left: (size - disc) / 2,
          width: disc,
          height: disc,
          borderRadius: "50%",
          backgroundColor: "#3a2a12",
          backgroundImage: flag ? `url("${flag}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(95,61,20,0.85)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 40% 35%, rgba(226,173,74,0.14), rgba(95,61,20,0.3))",
          }}
        />
        <Glyph
          style={{
            width: disc * 0.5,
            height: disc * 0.5,
            color: "rgba(52,32,6,0.62)",
            filter: "drop-shadow(0 1px 0 rgba(255,238,196,0.5))",
          }}
        />
      </div>
      {/* rim pips — living status by economic tier */}
      {showPips && (
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ bottom: size * 0.015, gap: size * 0.02 }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              style={{
                width: size * 0.09,
                height: size * 0.09,
                filter: "drop-shadow(0 1px 0 rgba(58,30,0,0.5))",
              }}
              className={
                i < pips ? "fill-amber-100 text-amber-100" : "fill-transparent text-amber-950/50"
              }
              strokeWidth={1.5}
            />
          ))}
        </div>
      )}
    </div>
  );
}
