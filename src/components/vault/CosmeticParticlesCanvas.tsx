"use client";

import { useId, useMemo } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { cn } from "~/lib/utils";
import * as SVG from "~/lib/particles/svg-data";

export interface CosmeticParticlesProps {
  style?: string;
  containerType: "frame" | "glow";
  className?: string;
}

interface SemanticPalette {
  cyan: string;
  red: string;
  orange: string;
  yellow: string;
  green: string;
  gold: string;
  neutral: string;
}

const FALLBACK_PALETTE: SemanticPalette = {
  cyan: "rgb(56, 189, 248)",
  red: "rgb(239, 68, 68)",
  orange: "rgb(249, 115, 22)",
  yellow: "rgb(250, 204, 21)",
  green: "rgb(16, 185, 129)",
  gold: "rgb(234, 179, 8)",
  neutral: "rgb(255, 255, 255)",
};

function readCssToken(styles: CSSStyleDeclaration, token: string, fallback: string): string {
  const value = styles.getPropertyValue(token).trim();
  return value || fallback;
}

function readSemanticPalette(): SemanticPalette {
  if (typeof document === "undefined") return FALLBACK_PALETTE;
  const styles = getComputedStyle(document.documentElement);
  return {
    cyan: readCssToken(styles, "--color-cyan", FALLBACK_PALETTE.cyan),
    red: readCssToken(styles, "--color-red", FALLBACK_PALETTE.red),
    orange: readCssToken(styles, "--color-orange", FALLBACK_PALETTE.orange),
    yellow: readCssToken(styles, "--color-yellow", FALLBACK_PALETTE.yellow),
    green: readCssToken(styles, "--color-green", FALLBACK_PALETTE.green),
    gold: readCssToken(styles, "--gold", FALLBACK_PALETTE.gold),
    neutral: FALLBACK_PALETTE.neutral,
  };
}

function shapesForStyle(style?: string): string[] {
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
}

function colorsForStyle(style: string | undefined, palette: SemanticPalette): string[] {
  if (!style) return [palette.neutral];
  switch (style.toLowerCase()) {
    case "winter":
      return [palette.cyan, palette.neutral];
    case "ruby":
      return [palette.red, palette.orange];
    case "emerald":
      return [palette.green, palette.cyan];
    case "summer":
      return [palette.orange, palette.yellow];
    case "imperial":
      return [palette.gold, palette.yellow];
    case "autumn":
      return [palette.orange, palette.gold];
    default:
      return [palette.neutral];
  }
}

const initParticles = async (engine: Engine): Promise<void> => {
  await loadSlim(engine);
};

export function CosmeticParticlesCanvas({
  style,
  containerType,
  className,
}: CosmeticParticlesProps) {
  const reduceMotion = useFacetReducedMotion();
  const uniqueId = useId();
  const palette = useMemo(
    () => (reduceMotion || !style ? FALLBACK_PALETTE : readSemanticPalette()),
    [reduceMotion, style]
  );

  const shapes = useMemo(() => shapesForStyle(style), [style]);
  const colors = useMemo(() => colorsForStyle(style, palette), [style, palette]);

  const options = useMemo((): ISourceOptions => {
    const isFrame = containerType === "frame";
    return {
      fullScreen: { enable: false },
      fpsLimit: 60,
      particles: {
        number: {
          value: isFrame ? 18 : 28,
          density: {
            enable: true,
            width: 400,
            height: 400,
          },
        },
        color: {
          value: colors,
        },
        shape: {
          type: shapes.length > 0 ? "image" : "circle",
          options: {
            image: shapes.map((path) => ({
              src: `data:image/svg+xml;utf8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>`
              )}`,
              width: 24,
              height: 24,
            })),
          },
        },
        opacity: {
          value: { min: 0.2, max: 0.8 },
          animation: {
            enable: true,
            speed: 1,
            sync: false,
          },
        },
        size: {
          value: { min: isFrame ? 4 : 3, max: isFrame ? 8 : 6 },
          animation: {
            enable: true,
            speed: 2,
            sync: false,
          },
        },
        move: {
          enable: true,
          speed: isFrame ? 0.8 : 1.2,
          direction: "none",
          random: true,
          straight: false,
          outModes: {
            default: "out",
          },
        },
        rotate: {
          value: { min: 0, max: 360 },
          direction: "random",
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

  if (reduceMotion || !style) return null;

  const id = `cosmetic-particles-${style}-${containerType}-${uniqueId.replace(/:/g, "")}`;

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <ParticlesProvider init={initParticles}>
        <Particles id={id} options={options} className="h-full w-full" />
      </ParticlesProvider>
    </div>
  );
}
