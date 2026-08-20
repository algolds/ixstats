"use client";

/**
 * MapLoadingScreen - Full-screen loading overlay for IxWorld map.
 *
 * Shows an animated globe with subsystem progress indicators while
 * map data and engine initialize. Fades out smoothly when ready.
 *
 * Inspired by GlobalBuilderLoading but themed for the world map.
 */

import { useState, useEffect } from "react";
import { Map, BookOpen, Image as ImageIcon, Database } from "lucide-react";
import { withBasePath } from "~/lib/base-path";

interface MapLoadingScreenProps {
  /** True when map data + engine are ready */
  isReady: boolean;
}

const SUBSYSTEMS = [
  { icon: Map, color: "text-blue-400", bg: "from-blue-400 to-blue-600", label: "Topography" },
  {
    icon: Database,
    color: "text-emerald-400",
    bg: "from-emerald-400 to-emerald-600",
    label: "Countries",
  },
  {
    icon: BookOpen,
    color: "text-amber-400",
    bg: "from-amber-400 to-amber-600",
    label: "Wiki Data",
  },
  {
    icon: ImageIcon,
    color: "text-purple-400",
    bg: "from-purple-400 to-purple-600",
    label: "Media",
  },
] as const;

export function MapLoadingScreen({ isReady }: MapLoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    // Start fade-out, then unmount
    setFadeOut(true);
    const timer = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timer);
  }, [isReady]);

  if (!visible) return null;

  return (
    <div
      className={`bg-map-ocean absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Subtle radial glow behind center */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-8 px-6 text-center">
        {/* Animated globe */}
        <div className="relative h-36 w-36">
          {/* Glow backdrop */}
          <div
            className="absolute inset-[-20%] animate-pulse rounded-full bg-blue-500/10 blur-2xl"
            style={{ animationDuration: "3s" }}
          />
          {/* Outer ring - slow spin with gradient */}
          <div
            className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full"
            style={{
              border: "2px solid transparent",
              backgroundImage:
                "conic-gradient(from 0deg, rgba(59,130,246,0.4), transparent 40%, rgba(147,51,234,0.3) 60%, transparent)",
              backgroundOrigin: "border-box",
              backgroundClip: "border-box",
            }}
          />
          {/* Middle ring - dashed, reverse spin */}
          <div className="absolute inset-3 animate-[spin_6s_linear_infinite_reverse] rounded-full border-[1.5px] border-dashed border-blue-400/25" />
          {/* Inner ring - fast spin */}
          <div className="absolute inset-6 animate-[spin_4s_linear_infinite] rounded-full border border-purple-300/20" />
          {/* Inner glow ring */}
          <div className="absolute inset-8 rounded-full border border-blue-400/10 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]" />
          {/* Center Ixnay logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={withBasePath("/images/ix-logo.svg?v=2")}
              alt="Ixnay"
              className="h-16 w-16 brightness-0 drop-shadow-[0_0_12px_rgba(147,197,253,0.5)] invert"
              style={{ animation: "logoPulse 2.5s ease-in-out infinite" }}
            />
          </div>
          {/* Orbiting dot 1 */}
          <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
            <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-0.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
          </div>
          {/* Orbiting dot 2 (opposite, slower) */}
          <div className="absolute inset-0 animate-[spin_5s_linear_infinite_reverse]">
            <div className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-0.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(147,51,234,0.6)]" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="bg-gradient-to-r from-blue-300 via-white to-purple-300 bg-clip-text text-3xl font-bold tracking-widest text-transparent">
            IxMaps™
          </h2>
          <p className="mt-1.5 text-sm tracking-wide text-white/40">Preparing the world...</p>
        </div>

        {/* Subsystem progress bars */}
        <div className="grid w-full grid-cols-2 gap-3">
          {SUBSYSTEMS.map((sys, i) => (
            <div key={sys.label} className="flex items-center gap-2">
              <sys.icon className={`h-4 w-4 shrink-0 ${sys.color}`} />
              <div className="flex-1">
                <div className="text-left text-[10px] font-medium text-white/50">{sys.label}</div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${sys.bg}`}
                    style={{
                      animation: `loadProgress ${1.5 + i * 0.4}s ease-out ${0.3 + i * 0.2}s both`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-blue-400/60"
              style={{
                animation: `dotPulse 1.5s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes loadProgress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        @keyframes dotPulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
        @keyframes logoPulse {
          0%,
          100% {
            opacity: 0.7;
            transform: scale(1);
            filter: brightness(0) invert(1) drop-shadow(0 0 12px rgba(147, 197, 253, 0.5));
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
            filter: brightness(0) invert(1) drop-shadow(0 0 20px rgba(147, 197, 253, 0.8));
          }
        }
      `}</style>
    </div>
  );
}
