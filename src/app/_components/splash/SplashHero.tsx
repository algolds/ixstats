"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Globe, StatUp as TrendingUp, Crown, ArrowRight, Hammer } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { isValidGlobalStats } from "./splash-stats";
import { IxTime } from "~/lib/ixtime";

interface SplashHeroProps {
  globalStats: unknown;
}

export function SplashHero({ globalStats }: SplashHeroProps) {
  const stats = isValidGlobalStats(globalStats) ? globalStats : null;
  const [earthClock, setEarthClock] = useState(false);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    // Live seconds clock — tick every 1s, but pause while the tab is hidden so we
    // don't re-render once a second in a backgrounded tab. (audit F6)
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id == null) id = setInterval(() => setClockTick((n) => n + 1), 1000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const realmCalendarLine = IxTime.formatIxTime(IxTime.getCurrentIxTime(), true);
  const earthTime = new Date().toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="mx-auto mt-8 mb-14 max-w-6xl text-center md:mt-16 md:mb-20"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="material-hero text-label mb-6 flex flex-col items-center gap-3 rounded-2xl px-4 py-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-4"
      >
        <div className="flex items-center gap-2">
          <div className={splashGold.pulseDot} aria-hidden />
          <span className="text-label text-headline tabular-nums">
            {stats ? `${stats.totalCountries.toLocaleString()} nations` : "— nations"}
          </span>
        </div>
        <span className="text-label-secondary hidden sm:inline" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => setEarthClock((e) => !e)}
          className="text-label rounded-control hover:text-facet-accent-ink focus-visible:outline-tint flex max-w-[min(92vw,36rem)] flex-col items-center gap-0.5 px-2 py-1 text-center transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 sm:items-start sm:text-left"
          aria-label={
            earthClock
              ? "Showing Earth time. Switch to IxTime."
              : "Showing IxTime. Switch to Earth time."
          }
        >
          <span className="text-headline sm:text-body tabular-nums">
            {earthClock ? earthTime : realmCalendarLine}
          </span>
          <span className="text-label-secondary text-eyebrow sm:text-footnote">
            {earthClock ? "Earth" : "IxTime"}
          </span>
        </button>
      </motion.div>

      <div className="mb-5 flex items-center justify-center gap-4 md:mb-6">
        <motion.div
          className={`relative h-16 w-16 rounded-full border-2 md:h-24 md:w-24 ${splashGold.border} shadow-card`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className={`absolute top-1/2 left-1/2 block h-9 w-9 -translate-x-1/2 -translate-y-1/2 md:h-12 md:w-12 ${splashGold.text}`}
            >
              <TrendingUp className="h-full w-full" strokeWidth={2.5} aria-hidden />
            </motion.span>
            <motion.span
              className={`absolute top-1 right-1 block h-4 w-4 md:h-5 md:w-5 ${splashGold.text}`}
            >
              <Crown className="h-full w-full" strokeWidth={2} aria-hidden />
            </motion.span>
            <motion.span
              className={`absolute bottom-1 left-1 block h-4 w-4 md:h-5 md:w-5 ${splashGold.text}`}
            >
              <Globe className="h-full w-full" strokeWidth={2} aria-hidden />
            </motion.span>
          </div>
        </motion.div>
        <h1 className={`text-display md:text-display ${splashGold.headline}`}>IxStats™</h1>
      </div>

      <p className="text-label text-title-2 md:text-large-title mx-auto mb-3 max-w-3xl">
        Everything runs. Everything connects.
      </p>

      <p className="text-label-secondary text-body md:text-title-3 mx-auto mb-3 max-w-2xl leading-relaxed">
        Lore and live stats in one place. Your wiki, your economy, your feed—updated continuously so
        the board reflects what nations actually do.
      </p>
      <p className="text-label-secondary text-body mx-auto mb-8 max-w-xl leading-relaxed">
        Collect lore cards, earn IxCredits, and unlock achievements in the{" "}
        <Link href="/vault" className={splashGold.link}>
          MyVault
        </Link>
        . Play NationStates? You can{" "}
        <Link href="/vault/import" className={splashGold.link}>
          import your deck
        </Link>{" "}
        too.
      </p>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-10 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
        >
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{stats.totalCountries}</div>
            <div className="text-label-secondary text-footnote md:text-body">Nations</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{formatCurrency(stats.totalGdp)}</div>
            <div className="text-label-secondary text-footnote md:text-body">World GDP</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{formatPopulation(stats.totalPopulation)}</div>
            <div className="text-label-secondary text-footnote md:text-body">Population</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{(stats.globalGrowthRate * 100).toFixed(3)}%</div>
            <div className="text-label-secondary text-footnote md:text-body">Global growth</div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {/* One focus stop per action: the link is the button (no <button> inside <a>). */}
        <Button asChild size="lg" variant="outline" className="border-tint/40 hover:bg-tint-fill">
          <Link href="/countries">
            Explore nations
            <motion.span className="ml-2 inline-block">
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </motion.span>
          </Link>
        </Button>
        {/* The gold primary (data-app="mycountry") with the v2 gold glow. */}
        <Button asChild size="lg" className="facet-glow">
          <Link href="/builder">
            <motion.span className="mr-2 inline-block">
              <Hammer aria-hidden="true" className="h-5 w-5" />
            </motion.span>
            Launch MyCountry Builder
          </Link>
        </Button>
      </div>
      <p className="text-label-secondary text-footnote md:text-body mx-auto mt-4 max-w-md leading-relaxed">
        The builder remembers you after sign-in. Preview it anytime.
      </p>
    </motion.div>
  );
}
