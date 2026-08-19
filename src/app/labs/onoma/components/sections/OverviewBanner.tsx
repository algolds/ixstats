"use client";

// src/app/labs/onoma/components/sections/OverviewBanner.tsx
// Onoma Lab — Welcome & Branding Banner subcomponent (Apple Design Attractor)

import { useState, useEffect } from "react";
import { Compass, Volume2, Info } from "lucide-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { OnomaDoubleHelixIcon } from "../shared/OnomaDoubleHelixIcon";
import { applyFlanking } from "~/lib/onoma/branding-utils";
import { cn } from "~/lib/utils";

interface OverviewBannerProps {
  speechConfig?: any;
  playPronunciation: () => void;
  isHeroHovered: boolean;
  setIsHeroHovered: (hovered: boolean) => void;
}

export function OverviewBanner({
  speechConfig,
  playPronunciation,
  isHeroHovered,
  setIsHeroHovered,
}: OverviewBannerProps) {
  const [hasInteracted, setHasInteracted] = useState<boolean>(true); // default true for SSR safety

  useEffect(() => {
    const tried = localStorage.getItem("onoma-pronunciation-tried");
    if (!tried) {
      setHasInteracted(false);
    }
  }, []);

  const handlePlay = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      localStorage.setItem("onoma-pronunciation-tried", "true");
    }
    playPronunciation();
  };

  const markInteracted = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      localStorage.setItem("onoma-pronunciation-tried", "true");
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHeroHovered(true)}
      onMouseLeave={() => setIsHeroHovered(false)}
      className="group relative overflow-hidden rounded-xl border border-[#0091ff]/20 bg-gradient-to-br from-[#0091ff]/[0.06] via-[#0091ff]/[0.02] to-indigo-500/[0.04] p-6 shadow-md shadow-[#0091ff]/2 backdrop-blur-md transition-all duration-500 hover:border-[#0091ff]/35 hover:shadow-[0_0_20px_rgba(0,145,255,0.06)] dark:from-[#0091ff]/[0.08] dark:via-[#0091ff]/[0.02] dark:to-indigo-500/[0.06] dark:hover:shadow-[0_0_24px_rgba(0,145,255,0.12)]"
    >
      {/* Texture Overlay */}
      <div className="pointer-events-none absolute -inset-2 opacity-[0.02] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-[0.08] group-hover:blur-[0.5px] dark:opacity-[0.12] dark:group-hover:opacity-[0.25]">
        <TextureOverlay texture="grid" className="mix-blend-overlay" />
      </div>

      <div className="relative z-10 max-w-xs space-y-2 sm:max-w-md md:max-w-lg lg:max-w-xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0091ff]/10 px-3 py-1 text-xs font-semibold text-[#0091ff]">
          <Compass className="h-3 w-3" />
          Onoma (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="relative inline-flex items-center">
                {!hasInteracted && (
                  <span className="pointer-events-none absolute -inset-1 animate-ping rounded-md bg-[#0091ff]/30 opacity-75 duration-1000" />
                )}
                <button
                  type="button"
                  onClick={handlePlay}
                  onMouseEnter={markInteracted}
                  className={cn(
                    "relative inline-flex cursor-pointer items-center gap-1 font-mono transition-all duration-200 select-none active:scale-[0.94] focus:outline-none",
                    !hasInteracted
                      ? "rounded-md bg-[#0091ff]/20 px-1.5 py-0.5 font-bold text-[#0091ff] shadow-[0_0_14px_rgba(0,145,255,0.45)] ring-1 ring-[#0091ff]/60 animate-pulse hover:scale-105"
                      : "underline decoration-[#0091ff]/40 decoration-dotted hover:scale-105 hover:text-[#0091ff] hover:decoration-[#0091ff]"
                  )}
                >
                  <span>/ˈɒnəmə/</span>
                  <Volume2
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-all duration-300",
                      !hasInteracted
                        ? "animate-bounce text-[#0091ff]"
                        : "opacity-70 hover:scale-110 hover:opacity-100"
                    )}
                  />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="text-xs font-semibold shadow-lg">
              {!hasInteracted
                ? "🔊 Click to hear authentic Greek pronunciation!"
                : "Click to listen to pronunciation"}
            </TooltipContent>
          </Tooltip>
          • Greek for “name,” root of onomastics)
        </span>
        <h1
          className="text-foreground text-2xl font-extrabold tracking-wide sm:text-3xl"
          style={{
            fontFamily: speechConfig?.brand?.fontFamily
              ? `'${speechConfig.brand.fontFamily}', sans-serif`
              : undefined,
          }}
        >
          {applyFlanking("Project Onoma", speechConfig?.brand?.flankingStyle)}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline cursor-help items-baseline font-medium text-foreground underline decoration-[#0091ff]/60 decoration-dotted underline-offset-4 transition-colors hover:text-[#0091ff] focus:outline-none"
              >
                Markov-based
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="max-w-xs text-xs font-normal leading-normal">
              A Markov chain is a mathematical procedural algorithm that calculates statistical letter and syllable transitions to generate coherent, natural names.
            </TooltipContent>
          </Tooltip>{" "}
          name generator for worldbuilding. Instantly create names from public name banks, or create
          your own set of data to generate any kind of name.
        </p>
        <div className="text-muted-foreground/60 flex items-center gap-1.5 pt-1 text-[11px] select-none">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#0091ff]/50" />
          <span>
            Disclaimer: Onoma is a mathematical procedural generator, not a generative AI / LLM
            model.
          </span>
        </div>
      </div>

      {/* Apple-style Glassmorphic App Icon Widget Container */}
      <div className="pointer-events-none absolute top-1/2 right-6 z-20 hidden -translate-y-1/2 items-center justify-center sm:flex">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22%] border border-white/50 bg-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_12px_48px_rgba(0,145,255,0.06)] sm:h-28 sm:w-28 dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_16px_56px_rgba(0,145,255,0.25)]">
          {/* Ambient background glow inside the squircle */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-[#0091ff]/10 to-indigo-500/10 opacity-60 transition-opacity duration-500 group-hover:opacity-100 dark:from-[#0091ff]/15 dark:to-indigo-500/15" />
          <OnomaDoubleHelixIcon
            className="relative z-10 h-4/5 w-4/5"
            isHovered={isHeroHovered}
            variation={speechConfig?.brand?.variation}
            nucleusSymbol={speechConfig?.brand?.nucleusSymbol}
          />
        </div>
      </div>
    </div>
  );
}
