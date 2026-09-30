"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "~/lib/utils";

interface FlagBackdropProps {
  /** Flag or header image; nothing renders without one. */
  src: string | null | undefined;
  /** How strongly the image shows through (fraction of full opacity). */
  intensity?: "subtle" | "regular";
  /** Which edge the image sits on before it fades into the card. */
  side?: "right" | "left";
  /** Adds a soft glow of the app tint in the opposite corner. */
  tintGlow?: boolean;
  className?: string;
}

const OPACITY = { subtle: "opacity-15", regular: "opacity-[0.28]" };

/**
 * The country's flag as a soft, faded identity wash behind a hero surface (Facet 3 allows decoration on
 * heroes). Purely decorative: aria-hidden, not printed, and it never covers content — render it as the
 * first child of a `relative overflow-hidden` card and keep content above it with `relative`.
 */
export function FlagBackdrop({
  src,
  intensity = "regular",
  side = "right",
  tintGlow = true,
  className,
}: FlagBackdropProps) {
  const [failed, setFailed] = useState(false);
  const fade: CSSProperties = {
    maskImage: `linear-gradient(to ${side === "right" ? "left" : "right"}, black 0%, black 25%, transparent 85%)`,
    WebkitMaskImage: `linear-gradient(to ${side === "right" ? "left" : "right"}, black 0%, black 25%, transparent 85%)`,
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] print:hidden",
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={fade}
          className={cn(
            "absolute inset-y-0 h-full w-full max-w-[42rem] scale-110 object-cover blur-[2px] saturate-[1.15]",
            side === "right" ? "right-0" : "left-0",
            OPACITY[intensity]
          )}
        />
      ) : null}
      {tintGlow ? (
        <div
          className={cn(
            "absolute -top-24 size-72 rounded-full opacity-15 blur-3xl",
            side === "right" ? "-left-20" : "-right-20"
          )}
          style={{ backgroundColor: "var(--tint)" }}
        />
      ) : null}
      {/* A hairline of the tint along the top edge. */}
      <div
        className="absolute inset-x-8 top-0 h-px opacity-70"
        style={{
          backgroundImage: "linear-gradient(to right, transparent, var(--tint), transparent)",
        }}
      />
    </div>
  );
}
