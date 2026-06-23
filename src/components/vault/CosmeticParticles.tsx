"use client";

import { useId, useMemo } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";
import { cn } from "~/lib/utils";
import * as SVG from "~/lib/particles/svg-data";

interface CosmeticParticlesProps {
  style?: string;
  containerType: "frame" | "glow";
  className?: string;
}

// Particle plugin registrar callback
const initParticles = async (engine: Engine): Promise<void> => {
  await loadSlim(engine);
};

function CosmeticParticlesInner({ style, containerType, className }: CosmeticParticlesProps) {
  const uniqueId = useId();

  // Map cosmetic style keys to custom SVG paths (memoized)
  const shapes = useMemo(() => {
    if (!style) return [];
    switch (style.toLowerCase()) {
      case "winter":
        return [SVG.SVG_SNOWFLAKE, SVG.SVG_SAPPHIRE];
      case "ruby":
        return [SVG.SVG_RUBY, SVG.SVG_DIAMOND];
      case "emerald":
        return [SVG.SVG_EMERALD, SVG.SVG_SHIELD];
      case "summer":
        return [SVG.SVG_STAR, SVG.SVG_TROPHY];
      case "imperial":
        return [SVG.SVG_CROWN, SVG.SVG_GOLD_COIN, SVG.SVG_IMPERIAL_EAGLE, SVG.SVG_STAR];
      case "autumn":
        return [SVG.SVG_LEAF];
      default:
        return [SVG.SVG_STAR];
    }
  }, [style]);

  // Map cosmetic style keys to colors (memoized)
  const colors = useMemo(() => {
    if (!style) return ["#ffffff"];
    switch (style.toLowerCase()) {
      case "winter":
        return ["#93c5fd", "#e0f2fe", "#38bdf8"];
      case "ruby":
        return ["#ef4444", "#fda4af", "#f43f5e"];
      case "emerald":
        return ["#10b981", "#6ee7b7", "#34d399"];
      case "summer":
        return ["#f97316", "#fbbf24", "#f59e0b"];
      case "imperial":
        return ["#fbbf24", "#eab308", "#f59e0b"];
      case "autumn":
        return ["#d97706", "#f59e0b", "#b45309"];
      default:
        return ["#ffffff"];
    }
  }, [style]);

  // Configure particle physics (memoized to prevent infinite canvas recreate loops)
  const options = useMemo(() => {
    const isFrame = containerType === "frame";
    const particleCount = isFrame ? 5 : 8;
    const speed = isFrame ? 0.5 : 0.8;
    const direction = isFrame ? "none" : "top";

    return {
      fullScreen: { enable: false },
      fpsLimit: 45,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: {
        events: {
          onHover: { enable: false },
          onClick: { enable: false },
        },
      },
      particles: {
        number: {
          value: particleCount,
          limit: { value: particleCount * 2 },
        },
        color: {
          value: colors,
        },
        shape: {
          type: "image",
          options: {
            image: shapes.map((src) => ({
              src,
              width: 32,
              height: 32,
            })),
          },
        },
        opacity: {
          value: { min: 0.25, max: 0.85 },
          animation: {
            enable: true,
            speed: 1,
            sync: false,
            startValue: "random",
          },
        },
        size: {
          value: { min: 8, max: 14 },
          animation: {
            enable: true,
            speed: 2,
            sync: false,
          },
        },
        move: {
          enable: true,
          speed: speed,
          direction: direction as any,
          random: true,
          straight: false,
          outModes: {
            default: "out" as const,
          },
          trail: {
            enable: false,
          },
        },
        rotate: {
          value: { min: 0, max: 360 },
          direction: "random" as const,
          animation: {
            enable: true,
            speed: 4,
            sync: false,
          },
        },
        collisions: {
          enable: false,
        },
      },
      detectRetina: true,
    };
  }, [containerType, shapes, colors]);

  if (!style) return null;

  // Generate stable id across renders to prevent infinite canvas recreations
  const id = `cosmetic-particles-${style}-${containerType}-${uniqueId.replace(/:/g, "")}`;

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <ParticlesProvider init={initParticles}>
        <Particles id={id} options={options as any} className="h-full w-full" />
      </ParticlesProvider>
    </div>
  );
}

// Wrap with dynamic loader to support code-splitting and prevent SSR canvas rendering errors
import dynamic from "next/dynamic";
export const CosmeticParticles = dynamic(() => Promise.resolve(CosmeticParticlesInner), {
  ssr: false,
});
