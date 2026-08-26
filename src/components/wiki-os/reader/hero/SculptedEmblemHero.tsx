"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Shuffle,
  Bookmark,
  MediaImage as ImageIcon,
  Globe,
  Star,
  ChatBubble as MessageSquare,
  ArrowUpRight,
  ArrowRight,
  User,
  ClockRotateRight as History,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  SunLight as Sun,
  CloudSunny as CloudSun,
  Cloud,
  Rain as CloudRain,
  HalfMoon as Moon,
  SnowFlake as Snowflake,
  Sparks as Sparkles,
  LightBulb as Lightbulb,
  Trophy as IconoirTrophy,
  OpenBook as IconoirOpenBook,
  Folder as IconoirFolder,
  Globe as IconoirGlobe,
} from "iconoir-react";
import { motion, useMotionValue, useSpring, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { IxWikiLogo } from "~/components/wiki-os/shared/IxWikiLogo";
import { IxWikiWordmark } from "~/components/wiki-os/shared/IxWikiWordmark";
import { IxTime } from "~/lib/ixtime/core";
import { getPrimeMeridianWeather, type WeatherIconType } from "~/lib/ixtime/weather";
import { HeroSpotlightSearch } from "./HeroSpotlightSearch";
import {
  FeaturedArticleRefractionCard,
  FeaturedThumbnailFrame,
} from "./FeaturedImageRefraction";
import type { WikiHeroProps } from "./types";

function WeatherIcon({ icon, className }: { icon: WeatherIconType; className?: string }) {
  switch (icon) {
    case "Sun":
      return <Sun className={className} />;
    case "CloudSun":
      return <CloudSun className={className} />;
    case "Cloud":
      return <Cloud className={className} />;
    case "CloudRain":
      return <CloudRain className={className} />;
    case "Moon":
      return <Moon className={className} />;
    case "Snowflake":
      return <Snowflake className={className} />;
  }
}

const CANON_CHRONICLE_EVENTS = [
  {
    year: "1894",
    title: "Treaty of Oakhaven",
    description: "Sovereign charter established between western continental powers.",
    slug: "Treaty_of_Oakhaven",
  },
  {
    year: "1914",
    title: "The Great Concordat",
    description: "Multi-national maritime navigation and free commerce accords ratified.",
    slug: "The_Great_Concordat",
  },
  {
    year: "1948",
    title: "Urcean Economic Reform",
    description: "Standardization of continental trade tariffs and central reserves.",
    slug: "Economy_of_Urcea",
  },
  {
    year: "1976",
    title: "The Trans-Continental Line",
    description: "First high-speed rail corridor connecting northern and southern realms.",
    slug: "Transportation_in_Ixnay",
  },
  {
    year: "2003",
    title: "The Sovereign Charter",
    description: "Founding of the modern geopolitical congress and lore repository.",
    slug: "Ixnay",
  },
  {
    year: "2028",
    title: "Global Census & Atlas",
    description: "Unified demographic baseline ratified across 82 sovereign nations.",
    slug: "Countries",
  },
];

function getCurrentWeekDays(date: Date) {
  const current = new Date(date);
  const dayOfWeek = current.getUTCDay();
  const sunday = new Date(current);
  sunday.setUTCDate(current.getUTCDate() - dayOfWeek);

  const days = [];
  const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + i);
    days.push({
      dayName: DAY_NAMES[i],
      dayNum: d.getUTCDate(),
      isToday: d.toISOString().slice(0, 10) === current.toISOString().slice(0, 10),
    });
  }
  return days;
}

export function SculptedEmblemHero({
  siteStats,
  activePrompt,
  featuredArticleHtml,
  featuredArticleData,
  refractionMode = "ambient-underglow",
  onOpenSearch,
  onOpenBlurbs,
}: WikiHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [clockTime, setClockTime] = useState<Date>(() => new Date(IxTime.getCurrentIxTime()));
  const [chronicleIndex, setChronicleIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  // Live ticking clock with 1-second cadence for IxTime
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(new Date(IxTime.getCurrentIxTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(clockTime.getUTCHours()).padStart(2, "0");
  const minutes = String(clockTime.getUTCMinutes()).padStart(2, "0");
  const hoursMinutes = `${hours}:${minutes}`;
  const weekdayShort = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][clockTime.getUTCDay()] || "SAT";
  const monthShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][clockTime.getUTCMonth()] || "AUG";
  const dayNum = clockTime.getUTCDate();
  const yearNum = clockTime.getUTCFullYear();
  const calendarWeekDays = getCurrentWeekDays(clockTime);
  const weather = useMemo(() => getPrimeMeridianWeather(clockTime), [clockTime]);

  const articleCountStr = siteStats?.articles
    ? `${siteStats.articles.toLocaleString()}+`
    : "1,400+";

  const searchPlaceholders = useMemo(
    () => [`Search ${articleCountStr} articles...`],
    [articleCountStr]
  );

  const handleSearchClick = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    }
  };

  return (
    <section
      aria-label="WikiOS Sculpted Emblem Hero"
      className="relative w-full pt-1 pb-2 sm:pb-3 flex flex-col items-center justify-center text-center select-none"
    >
      {/* ── 1. The Free-Standing Canonical Laurel Sphere & Typographic Lockup (Centered) ── */}
      <Link
        href={withBasePath("/wiki/Main_Page")}
        className="group/brand flex flex-col items-center justify-center text-center select-none cursor-pointer mb-1"
      >
        <motion.div
          whileHover={reduceMotion ? {} : { scale: 1.04, y: -2 }}
          whileTap={reduceMotion ? {} : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
          className="relative mb-2.5 sm:mb-3 flex items-center justify-center"
          aria-label="IxWiki Home"
        >
          {/* The Canonical Laurel Sphere Logo - Sculpted Emblem View */}
          <IxWikiLogo
            size={96}
            className="relative z-10 h-22 w-22 sm:h-26 sm:w-26 lg:h-28 lg:w-28 text-wiki dark:text-blue-400 drop-shadow-[0_4px_20px_rgba(29,78,137,0.2)] dark:drop-shadow-[0_4px_24px_rgba(96,165,250,0.38)] transition-transform duration-300 ease-out group-hover/brand:scale-[1.03]"
          />
        </motion.div>

        {/* Typographic Wordmark & Subtitle */}
        <div className="flex flex-col items-center justify-center gap-1 max-w-xl px-4">
          <IxWikiWordmark size="hero" className="transition-colors group-hover/brand:text-foreground/90 leading-none" />
          <div className="mt-1.5 flex items-center justify-center">
            <span className="tracking-[0.18em] uppercase text-[11px] sm:text-xs font-semibold text-muted-foreground/75 leading-none">
              Worldbuilding Encyclopedia
            </span>
          </div>
        </div>
      </Link>

      {/* ── 3. Floating Glass Omnisearch Bar ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl px-4 mt-3 sm:mt-3.5 relative z-30"
      >
        <HeroSpotlightSearch placeholderHints={searchPlaceholders} />
      </motion.div>

      {/* ── 4. Prestigious Quick Navigation Chips (Non-Sidebar Exploratory Actions) ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full pt-1 pb-2 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
      >
        {/* Action 1: Award-Winning Lore */}
        <Link
          href={withBasePath("/wiki/category:featured_articles")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 dark:bg-zinc-900/65 backdrop-blur-md",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-amber-500/40 hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.1]",
            "text-muted-foreground hover:text-foreground transition-colors duration-150 active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          )}
        >
          <IconoirTrophy className="h-3.5 w-3.5 text-amber-500 transition-transform group-hover:scale-110" />
          <span>Award-Winning Lore</span>
        </Link>

        {/* Action 2: Getting Started */}
        <Link
          href={withBasePath("/wiki/IxWiki:Getting_Started")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 dark:bg-zinc-900/65 backdrop-blur-md",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-sky-500/40 hover:bg-sky-500/[0.06] dark:hover:bg-sky-500/[0.1]",
            "text-muted-foreground hover:text-foreground transition-colors duration-150 active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          )}
        >
          <IconoirOpenBook className="h-3.5 w-3.5 text-sky-500 transition-transform group-hover:scale-110" />
          <span>Getting Started</span>
        </Link>

        {/* Action 3: Resources */}
        <Link
          href={withBasePath("/wiki/repository")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 dark:bg-zinc-900/65 backdrop-blur-md",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.1]",
            "text-muted-foreground hover:text-foreground transition-colors duration-150 active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          )}
        >
          <IconoirFolder className="h-3.5 w-3.5 text-emerald-500 transition-transform group-hover:scale-110" />
          <span>Resources</span>
        </Link>
      </motion.div>

      {/* ── 5. Standardized 2-Column Live Interaction Deck (Timeline & Community Prompt) ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 mt-4 sm:mt-5 w-full px-4 max-w-6xl"
      >
        {/* Tile: Timeline (Milestones & Canon Historical Events) */}
        <div
          className={cn(
            "relative overflow-hidden flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl min-h-[82px] sm:min-h-[86px]",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
            "hover:border-black/20 dark:hover:border-white/20 hover:bg-white/85 dark:hover:bg-zinc-900/85 hover:shadow-md",
            "transition-colors duration-200 group text-left"
          )}
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Timeline
            </span>
            {/* Apple-grade stepper pill */}
            <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setChronicleIndex((prev) => (prev === 0 ? CANON_CHRONICLE_EVENTS.length - 1 : prev - 1));
                }}
                data-cuelume-press="tick"
                data-cuelume-hover="tick"
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all active:scale-90 cursor-pointer"
                aria-label="Previous historical event"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="text-[10px] font-medium px-1 text-muted-foreground/80 select-none tabular-nums">
                {chronicleIndex + 1}/{CANON_CHRONICLE_EVENTS.length}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setChronicleIndex((prev) => (prev + 1) % CANON_CHRONICLE_EVENTS.length);
                }}
                data-cuelume-press="tick"
                data-cuelume-hover="tick"
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all active:scale-90 cursor-pointer"
                aria-label="Next historical event"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Animated Historical Chronicle Item */}
          <div className="relative overflow-hidden flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={chronicleIndex}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <Link
                  href={withBasePath(`/wiki/${CANON_CHRONICLE_EVENTS[chronicleIndex].slug}`)}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="block group/event active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 tabular-nums">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].year}
                    </span>
                    <span className="text-xs sm:text-[13px] font-semibold text-foreground truncate group-hover/event:text-amber-500 transition-colors leading-tight">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].title}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground line-clamp-1 block mt-0.5 leading-snug">
                    {CANON_CHRONICLE_EVENTS[chronicleIndex].description}
                  </span>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Tile: Daily Blurb (Interactive Community Prompt) */}
        {activePrompt ? (
          <button
            type="button"
            onClick={onOpenBlurbs}
            data-cuelume-press="droplet"
            data-cuelume-hover="tick"
            className={cn(
              "relative overflow-hidden flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl min-h-[82px] sm:min-h-[86px]",
              "border border-black/[0.08] dark:border-white/[0.1]",
              "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
              "hover:border-black/20 dark:hover:border-white/20 hover:bg-white/85 dark:hover:bg-zinc-900/85 hover:shadow-md",
              "transition-colors duration-200 group text-left active:scale-[0.98] cursor-pointer"
            )}
          >
            <TextureOverlay texture="paperGrain" opacity={0.06} />
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Blurb of the Week
              </span>
              <div className="flex items-center gap-1">
                {activePrompt._count?.responses !== undefined && activePrompt._count.responses > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 dark:text-purple-300 transition-all duration-200 group-hover:bg-purple-500/20 group-hover:border-purple-500/30">
                    <span className="tabular-nums">{activePrompt._count.responses}</span>
                    <span className="opacity-75">{activePrompt._count.responses === 1 ? "response" : "responses"}</span>
                    <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 dark:text-purple-300 transition-all duration-200 group-hover:bg-purple-500/20 group-hover:border-purple-500/30">
                    <span>Respond now</span>
                    <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs sm:text-[13px] font-semibold text-foreground truncate block group-hover:text-foreground transition-colors leading-tight">
                {activePrompt.title}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground truncate block mt-0.5">
                {activePrompt.question}
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenBlurbs}
            data-cuelume-press="droplet"
            data-cuelume-hover="tick"
            className={cn(
              "relative overflow-hidden flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl min-h-[82px] sm:min-h-[86px]",
              "border border-black/[0.08] dark:border-white/[0.1]",
              "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
              "hover:border-black/20 dark:hover:border-white/20 hover:bg-white/85 dark:hover:bg-zinc-900/85 hover:shadow-md",
              "transition-colors duration-200 group text-left active:scale-[0.98] cursor-pointer"
            )}
          >
            <TextureOverlay texture="paperGrain" opacity={0.06} />
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Blurb of the Week
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 dark:text-purple-300 transition-all duration-200 group-hover:bg-purple-500/20 group-hover:border-purple-500/30">
                <span>View prompts</span>
                <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </span>
            </div>
            <div>
              <span className="text-xs sm:text-[13px] font-semibold text-foreground truncate block group-hover:text-foreground transition-colors leading-tight">
                Worldbuilding Prompts
              </span>
              <span className="text-[11px] font-medium text-muted-foreground truncate block mt-0.5">
                Share your nation's perspective
              </span>
            </div>
          </button>
        )}
      </motion.div>

      {/* ── 7. Standardized Embedded Featured Article (Apple Editorial Standard) ── */}
      {(featuredArticleData || featuredArticleHtml) && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="relative z-10 w-full mt-4 sm:mt-5 text-left"
        >
          <FeaturedArticleRefractionCard
            imgSrc={featuredArticleData?.imgSrc ?? null}
            mode={refractionMode}
          >
            {/* Seamless Top Bar (No dividing line, airy editorial flow) */}
            <div className="relative z-10 mb-3.5 sm:mb-4 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold tracking-tight">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  <span>Featured Article</span>
                </div>
                {/* Live Author / Editorial Byline */}
                {(() => {
                  const creator = featuredArticleData?.authorInfo?.creator;
                  const creatorName = typeof creator === "object" ? (creator as any)?.username : creator;
                  if (!creatorName) return null;
                  return (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <span className="text-muted-foreground/40 select-none">·</span>
                      <span className="flex items-center gap-1">
                        {featuredArticleData?.authorInfo?.creatorAvatar ? (
                          <img
                            src={featuredArticleData.authorInfo.creatorAvatar}
                            alt={creatorName}
                            className="w-3.5 h-3.5 rounded-full object-cover border border-black/10 dark:border-white/20"
                          />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground/70" />
                        )}
                        <span>By <strong className="text-foreground font-semibold">{creatorName}</strong></span>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Archive & Suggest Links */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_articles")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="hover:text-foreground transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <History className="h-3 w-3" />
                  <span>Archive</span>
                </Link>
                <span className="text-muted-foreground/30 select-none">·</span>
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_article_candidates")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="hover:text-amber-500 dark:hover:text-amber-400 transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span>Suggest</span>
                </Link>
              </div>
            </div>

            {/* Featured Article Card Body */}
            {featuredArticleData ? (
              <div className="relative z-10 flex flex-col sm:flex-row items-start gap-4 sm:gap-5 lg:gap-6">
                {featuredArticleData.imgSrc && (
                  <FeaturedThumbnailFrame
                    imgSrc={featuredArticleData.imgSrc}
                    title={featuredArticleData.title}
                    slug={featuredArticleData.slug}
                  />
                )}
                <div className="flex-1 flex flex-col justify-between self-stretch min-w-0 py-0.5">
                  <div>
                    <Link
                      href={withBasePath(`/wiki/${featuredArticleData.slug}`)}
                      data-cuelume-press="page"
                      data-cuelume-hover="tick"
                      className="group/title block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                    >
                      <h3 className="text-lg sm:text-xl lg:text-[22px] font-bold text-foreground tracking-tight leading-snug group-hover/title:text-amber-500 dark:group-hover/title:text-amber-400 transition-colors">
                        {featuredArticleData.title}
                      </h3>
                    </Link>
                    <p className="text-xs sm:text-[13.5px] leading-relaxed text-muted-foreground line-clamp-3 mt-2 font-normal">
                      {featuredArticleData.summary}
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-4 flex items-center gap-3">
                    <Link
                      href={withBasePath(`/wiki/${featuredArticleData.slug}`)}
                      data-cuelume-press="droplet"
                      data-cuelume-hover="tick"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-amber-500 dark:hover:text-amber-400 transition-colors group/cta"
                    >
                      <span>Read full article</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative z-10 wikios-main-featured-content wikios-article-content text-left leading-relaxed text-sm"
                dangerouslySetInnerHTML={{ __html: featuredArticleHtml ?? "" }}
              />
            )}
          </FeaturedArticleRefractionCard>
        </motion.div>
      )}
    </section>
  );
}
