import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  // oxlint-disable-next-line eslint/no-unused-vars
  Shuffle,
  // oxlint-disable-next-line eslint/no-unused-vars
  MediaImage as ImageIcon,
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
  LightBulb as Lightbulb,
  Trophy as IconoirTrophy,
  OpenBook as IconoirOpenBook,
  Folder as IconoirFolder,
} from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { IxWikiLogo } from "~/components/wiki-os/shared/IxWikiLogo";
import { IxWikiWordmark } from "~/components/wiki-os/shared/IxWikiWordmark";
import { IxTime } from "~/lib/ixtime/core";
import { getPrimeMeridianWeather, type WeatherIconType } from "~/lib/ixtime/weather";
import { HeroSpotlightSearch } from "./HeroSpotlightSearch";
import { FeaturedArticleRefractionCard, FeaturedThumbnailFrame } from "./FeaturedImageRefraction";
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

export function EditorialMastheadHero({
  siteStats,
  activePrompt,
  featuredArticleHtml,
  featuredArticleData,
  refractionMode = "ambient-underglow",
  onOpenSearch,
  onOpenBlurbs,
}: WikiHeroProps) {
  const reduceMotion = useReducedMotion();
  const [clockTime, setClockTime] = useState<Date>(() => new Date(IxTime.getCurrentIxTime()));
  const [chronicleIndex, setChronicleIndex] = useState(0);

  // Live ticking clock with 1-second cadence for IxTime
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(new Date(IxTime.getCurrentIxTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(clockTime.getUTCHours()).padStart(2, "0");
  const minutes = String(clockTime.getUTCMinutes()).padStart(2, "0");
  // oxlint-disable-next-line eslint/no-unused-vars
  const hoursMinutes = `${hours}:${minutes}`;
  const weekdayShort =
    ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][clockTime.getUTCDay()] || "SAT";
  const monthShort =
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][
      clockTime.getUTCMonth()
    ] || "AUG";
  const dayNum = clockTime.getUTCDate();
  const yearNum = clockTime.getUTCFullYear();
  // oxlint-disable-next-line eslint/no-unused-vars
  const calendarWeekDays = getCurrentWeekDays(clockTime);
  const weather = useMemo(() => getPrimeMeridianWeather(clockTime), [clockTime]);

  const articleCountStr = siteStats?.articles
    ? `${siteStats.articles.toLocaleString()}+`
    : "1,400+";

  const searchPlaceholders = useMemo(
    () => [`Search ${articleCountStr} articles...`],
    [articleCountStr]
  );

  // oxlint-disable-next-line eslint/no-unused-vars
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
    <section aria-label="WikiOS Editorial Masthead" className="w-full select-none">
      {/* ── 2. Balanced Editorial Header (Left Logo Lockup & Right Spotlight Search) ── */}
      <div className="flex w-full flex-col justify-between gap-4 py-1 sm:py-2 md:flex-row md:items-center md:gap-8">
        {/* Left Section: Free-standing Laurel Emblem + Wordmark + Tagline Lockup */}
        <Link
          href={withBasePath("/wiki/Main_Page")}
          className="group/brand inline-flex shrink-0 cursor-pointer items-center gap-4.5 text-left select-none sm:gap-6"
        >
          <motion.div
            whileHover={reduceMotion ? {} : { scale: 1.04, y: -2 }}
            whileTap={reduceMotion ? {} : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
            className="relative flex shrink-0 items-center justify-center"
            aria-label="IxWiki Home"
          >
            {/* The Canonical Laurel Sphere Logo - Monumental NYT/WaPo Scale */}
            <IxWikiLogo
              size={104}
              className="text-wiki relative z-10 h-20 w-20 drop-shadow-[0_4px_20px_rgba(29,78,137,0.22)] transition-transform duration-300 ease-out group-hover/brand:scale-[1.03] sm:h-24 sm:w-24 lg:h-28 lg:w-28 dark:text-blue-400 dark:drop-shadow-[0_4px_24px_rgba(96,165,250,0.4)]"
            />
          </motion.div>
          <div className="my-auto flex flex-col justify-center">
            <IxWikiWordmark
              size="2xl"
              className="group-hover/brand:text-foreground/90 leading-none transition-colors"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-muted-foreground/80 block text-[10.5px] leading-none font-bold tracking-[0.18em] uppercase sm:text-[11.5px]">
                Worldbuilding Encyclopedia
              </span>
              <span className="text-muted-foreground/40 hidden select-none sm:inline">•</span>
              {/* Live Editorial Dateline & Weather Telemetry */}
              <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] sm:text-[11.5px]">
                <span suppressHydrationWarning className="text-muted-foreground/85 font-medium">
                  {weekdayShort}, {monthShort} {dayNum}, {yearNum}
                </span>
                <span className="text-muted-foreground/40 select-none">·</span>
                <span
                  className="inline-flex cursor-help items-center gap-1 font-medium text-amber-600 dark:text-amber-400"
                  title={`Prime Meridian: ${weather.condition} (${weather.summary})`}
                >
                  <WeatherIcon icon={weather.icon} className="h-3 w-3 shrink-0 text-amber-500" />
                  <span>{weather.tempC}°C</span>
                  <span className="text-muted-foreground/60 hidden font-normal lg:inline">
                    · {weather.condition}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Right Section: Inline Apple Spotlight Search Bar */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-30 w-full shrink-0 md:w-80 lg:w-96"
        >
          <HeroSpotlightSearch placeholderHints={searchPlaceholders} />
        </motion.div>
      </div>

      {/* ── 4. Quick-Launch Chips Dock (Left-Aligned with Header Flow) ── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full flex-wrap items-center justify-start gap-2 pt-1 pb-2 sm:gap-2.5"
      >
        {/* Action 1: Award-Winning Lore */}
        <Link
          href={withBasePath("/wiki/category:featured_articles")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 backdrop-blur-md dark:bg-zinc-900/65",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-amber-500/40 hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.1]",
            "text-muted-foreground hover:text-foreground group transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
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
            "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 backdrop-blur-md dark:bg-zinc-900/65",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-sky-500/40 hover:bg-sky-500/[0.06] dark:hover:bg-sky-500/[0.1]",
            "text-muted-foreground hover:text-foreground group transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none active:scale-95"
          )}
        >
          <IconoirOpenBook className="h-3.5 w-3.5 text-sky-500 transition-transform group-hover:scale-110" />
          <span>Getting Started</span>
        </Link>

        {/* Action 3: Resources (Media & Templates) */}
        <Link
          href={withBasePath("/wiki/repository")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/65 backdrop-blur-md dark:bg-zinc-900/65",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.2)]",
            "hover:border-emerald-500/40 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.1]",
            "text-muted-foreground hover:text-foreground group transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none active:scale-95"
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
        transition={{ duration: 0.35, delay: 0.14 }}
        className="mt-3 grid w-full grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2"
      >
        {/* Tile: Timeline (Milestones & Canon Historical Events) */}
        <div
          className={cn(
            "relative flex min-h-[82px] flex-col justify-between overflow-hidden rounded-2xl p-3 sm:min-h-[86px] sm:p-3.5",
            "border border-black/[0.08] dark:border-white/[0.1]",
            "bg-white/70 backdrop-blur-xl dark:bg-zinc-900/70",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
            "hover:border-black/20 hover:bg-white/85 hover:shadow-md dark:hover:border-white/20 dark:hover:bg-zinc-900/85",
            "group text-left transition-all duration-200"
          )}
        >
          <TextureOverlay texture="paperGrain" opacity={0.06} />
          <div className="mb-1 flex w-full items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
              <History className="h-3.5 w-3.5" /> Timeline
            </span>
            {/* Apple-grade stepper pill */}
            <div className="flex items-center gap-0.5 rounded-md border border-black/[0.04] bg-black/[0.04] px-1 py-0.5 dark:border-white/[0.06] dark:bg-white/[0.05]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setChronicleIndex((prev) =>
                    prev === 0 ? CANON_CHRONICLE_EVENTS.length - 1 : prev - 1
                  );
                }}
                data-cuelume-press="tick"
                data-cuelume-hover="tick"
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5 transition-all hover:bg-black/10 active:scale-90 dark:hover:bg-white/10"
                aria-label="Previous historical event"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="text-muted-foreground/80 px-1 text-[10px] font-medium tabular-nums select-none">
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
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5 transition-all hover:bg-black/10 active:scale-90 dark:hover:bg-white/10"
                aria-label="Next historical event"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Animated Historical Chronicle Item */}
          <div className="relative flex items-center overflow-hidden">
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
                  className="group/event block transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="py-0.2 shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 text-[9.5px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].year}
                    </span>
                    <span className="text-foreground truncate text-xs leading-tight font-semibold transition-colors group-hover/event:text-amber-500 sm:text-[13px]">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].title}
                    </span>
                  </div>
                  <span className="text-muted-foreground mt-0.5 line-clamp-1 block text-[11px] leading-snug font-medium">
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
              "relative flex min-h-[82px] flex-col justify-between overflow-hidden rounded-2xl p-3 sm:min-h-[86px] sm:p-3.5",
              "border border-black/[0.08] dark:border-white/[0.1]",
              "bg-white/70 backdrop-blur-xl dark:bg-zinc-900/70",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
              "hover:border-black/20 hover:bg-white/85 hover:shadow-md dark:hover:border-white/20 dark:hover:bg-zinc-900/85",
              "group cursor-pointer text-left transition-colors duration-200 active:scale-[0.98]"
            )}
          >
            <TextureOverlay texture="paperGrain" opacity={0.06} />
            <div className="mb-1 flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-purple-500 uppercase dark:text-purple-400">
                <MessageSquare className="h-3.5 w-3.5" /> Blurb of the Week
              </span>
              <div className="flex items-center gap-1">
                {activePrompt._count?.responses !== undefined &&
                activePrompt._count.responses > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 transition-all duration-200 group-hover:border-purple-500/30 group-hover:bg-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300">
                    <span className="tabular-nums">{activePrompt._count.responses}</span>
                    <span className="opacity-75">
                      {activePrompt._count.responses === 1 ? "response" : "responses"}
                    </span>
                    <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 transition-all duration-200 group-hover:border-purple-500/30 group-hover:bg-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300">
                    <span>Respond now</span>
                    <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-foreground group-hover:text-foreground block truncate text-xs leading-tight font-semibold transition-colors sm:text-[13px]">
                {activePrompt.title}
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-[11px] font-medium">
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
              "relative flex min-h-[82px] flex-col justify-between overflow-hidden rounded-2xl p-3 sm:min-h-[86px] sm:p-3.5",
              "border border-black/[0.08] dark:border-white/[0.1]",
              "bg-white/70 backdrop-blur-xl dark:bg-zinc-900/70",
              "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_14px_rgba(0,0,0,0.2)]",
              "hover:border-black/20 hover:bg-white/85 hover:shadow-md dark:hover:border-white/20 dark:hover:bg-zinc-900/85",
              "group cursor-pointer text-left transition-colors duration-200 active:scale-[0.98]"
            )}
          >
            <TextureOverlay texture="paperGrain" opacity={0.06} />
            <div className="mb-1 flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-purple-500 uppercase dark:text-purple-400">
                <MessageSquare className="h-3.5 w-3.5" /> Blurb of the Week
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-purple-600 transition-all duration-200 group-hover:border-purple-500/30 group-hover:bg-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300">
                <span>View prompts</span>
                <ArrowUpRight className="h-2.5 w-2.5 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </span>
            </div>
            <div>
              <span className="text-foreground group-hover:text-foreground block truncate text-xs leading-tight font-semibold transition-colors sm:text-[13px]">
                Worldbuilding Prompts
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-[11px] font-medium">
                Share your nation's perspective
              </span>
            </div>
          </button>
        )}
      </motion.div>

      {/* ── 6. Standardized Embedded Featured Article (Apple Editorial Standard) ── */}
      {(featuredArticleData || featuredArticleHtml) && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
          className="mt-4 w-full text-left sm:mt-5"
        >
          <FeaturedArticleRefractionCard
            imgSrc={featuredArticleData?.imgSrc ?? null}
            mode={refractionMode}
          >
            {/* Seamless Top Bar (No dividing line, airy editorial flow) */}
            <div className="relative z-10 mb-3.5 flex items-center justify-between gap-2 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  <span>Featured Article</span>
                </div>
                {/* Live Author / Editorial Byline */}
                {(() => {
                  const creator = featuredArticleData?.authorInfo?.creator;
                  const creatorName =
                    typeof creator === "object" ? (creator as any)?.username : creator;
                  if (!creatorName) return null;
                  return (
                    <div className="text-muted-foreground hidden items-center gap-1.5 text-xs font-medium sm:flex">
                      <span className="text-muted-foreground/40 select-none">·</span>
                      <span className="flex items-center gap-1">
                        {featuredArticleData?.authorInfo?.creatorAvatar ? (
                          <img
                            src={featuredArticleData.authorInfo.creatorAvatar}
                            alt={creatorName}
                            className="h-3.5 w-3.5 rounded-full border border-black/10 object-cover dark:border-white/20"
                          />
                        ) : (
                          <User className="text-muted-foreground/70 h-3 w-3" />
                        )}
                        <span>
                          By{" "}
                          <strong className="text-foreground font-semibold">{creatorName}</strong>
                        </span>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Archive & Suggest Links */}
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_articles")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="hover:text-foreground flex items-center gap-1 text-[11px] font-medium transition-colors"
                >
                  <History className="h-3 w-3" />
                  <span>Archive</span>
                </Link>
                <span className="text-muted-foreground/30 select-none">·</span>
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_article_candidates")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-amber-500 dark:hover:text-amber-400"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span>Suggest</span>
                </Link>
              </div>
            </div>

            {/* Featured Article Card Body */}
            {featuredArticleData ? (
              <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:gap-5 lg:gap-6">
                {featuredArticleData.imgSrc && (
                  <FeaturedThumbnailFrame
                    imgSrc={featuredArticleData.imgSrc}
                    title={featuredArticleData.title}
                    slug={featuredArticleData.slug}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
                  <div>
                    <Link
                      href={withBasePath(`/wiki/${featuredArticleData.slug}`)}
                      data-cuelume-press="page"
                      data-cuelume-hover="tick"
                      className="group/title block rounded focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                    >
                      <h3 className="text-foreground text-lg leading-snug font-bold tracking-tight transition-colors group-hover/title:text-amber-500 sm:text-xl lg:text-[22px] dark:group-hover/title:text-amber-400">
                        {featuredArticleData.title}
                      </h3>
                    </Link>
                    <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-relaxed font-normal sm:text-[13.5px]">
                      {featuredArticleData.summary}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3 sm:mt-4">
                    <Link
                      href={withBasePath(`/wiki/${featuredArticleData.slug}`)}
                      data-cuelume-press="droplet"
                      data-cuelume-hover="tick"
                      className="text-foreground group/cta inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-amber-500 dark:hover:text-amber-400"
                    >
                      <span>Read full article</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="wikios-main-featured-content wikios-article-content relative z-10 text-left text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: featuredArticleHtml ?? "" }}
              />
            )}
          </FeaturedArticleRefractionCard>
        </motion.div>
      )}
    </section>
  );
}
