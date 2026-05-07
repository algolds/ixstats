"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  Globe,
  TrendingUp,
  Crown,
  ArrowRight,
  Hammer,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
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
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
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
        className={`glass-hierarchy-parent mb-6 flex flex-col items-center gap-3 rounded-2xl border px-4 py-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-3.5 ${splashGold.border} ${splashGold.darkBorder}`}
      >
        <div className="flex items-center gap-2">
          <div className={splashGold.pulseDot} aria-hidden />
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {stats ? `${stats.totalCountries.toLocaleString()} nations` : "— nations"}
          </span>
        </div>
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => setEarthClock((e) => !e)}
          className="text-foreground hover:text-amber-700 dark:hover:text-amber-300 flex max-w-[min(92vw,36rem)] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-center transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40 sm:items-start sm:text-left"
          aria-label={earthClock ? "Showing Earth time. Switch to IxTime." : "Showing IxTime. Switch to Earth time."}
        >
          <span className="text-sm font-semibold tabular-nums tracking-tight sm:text-base">
            {earthClock ? earthTime : realmCalendarLine}
          </span>
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide sm:text-[11px]">
            {earthClock ? "Earth" : "IxTime"}
          </span>
        </button>
      </motion.div>

      <div className="mb-5 flex items-center justify-center gap-4 md:mb-6">
        <motion.div
          className={`relative h-16 w-16 rounded-full border-2 md:h-24 md:w-24 ${splashGold.border} ${splashGold.darkBorder} shadow-md ${splashGold.activeGlow}`}
          animate={{ rotate: [0, 1.5, -1.5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className={`absolute top-1/2 left-1/2 block h-9 w-9 -translate-x-1/2 -translate-y-1/2 md:h-12 md:w-12 ${splashGold.text}`}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <TrendingUp className="h-full w-full" strokeWidth={2.5} aria-hidden />
            </motion.span>
            <motion.span
              className={`absolute top-1 right-1 block h-4 w-4 md:h-5 md:w-5 ${splashGold.text}`}
              animate={{ y: [0, -4, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            >
              <Crown className="h-full w-full" strokeWidth={2} aria-hidden />
            </motion.span>
            <motion.span
              className={`absolute bottom-1 left-1 block h-4 w-4 md:h-5 md:w-5 ${splashGold.text}`}
              animate={{ y: [0, 3, 0] }}
              transition={{ duration: 4.1, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            >
              <Globe className="h-full w-full" strokeWidth={2} aria-hidden />
            </motion.span>
          </div>
        </motion.div>
        <h1 className={`text-5xl font-bold md:text-8xl ${splashGold.headline}`}>IxStats™</h1>
      </div>

      <p className="text-foreground mx-auto mb-3 max-w-3xl text-xl font-semibold tracking-tight md:text-3xl">
        Everything runs. Everything connects.
      </p>

      <p className="text-muted-foreground mx-auto mb-3 max-w-2xl text-base leading-relaxed md:text-lg">
        Lore and live stats in one place. Your wiki, your economy, your feed—updated continuously so the board reflects
        what nations actually do.
      </p>
      <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-sm leading-relaxed">
        Cards from elsewhere? Bring them home through{" "}
        <Link href="/vault/import" className={splashGold.link}>
          MyVault import
        </Link>
        .
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
            <div className="text-muted-foreground text-xs md:text-sm">Nations</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{formatCurrency(stats.totalGdp)}</div>
            <div className="text-muted-foreground text-xs md:text-sm">World GDP</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{formatPopulation(stats.totalPopulation)}</div>
            <div className="text-muted-foreground text-xs md:text-sm">Population</div>
          </div>
          <div className={splashGold.statCard}>
            <div className={splashGold.statValue}>{(stats.globalGrowthRate * 100).toFixed(3)}%</div>
            <div className="text-muted-foreground text-xs md:text-sm">Global growth</div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        <Link href="/countries">
          <Button
            size="lg"
            variant="outline"
            className={`border-2 px-6 py-5 text-base md:px-10 md:py-6 md:text-lg ${splashGold.border} hover:bg-amber-500/10 dark:hover:bg-amber-950/40`}
          >
            Explore nations
            <motion.span
              className="ml-2 inline-block"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowRight className="h-5 w-5" />
            </motion.span>
          </Button>
        </Link>
        <Link href="/builder">
          <Button
            size="lg"
            className={`bg-gradient-to-r px-6 py-5 text-base text-white shadow-lg md:px-10 md:py-6 md:text-lg ${splashGold.gradient} ${splashGold.activeGlow} hover:opacity-95`}
          >
            <motion.span
              className="mr-2 inline-block"
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Hammer className="h-5 w-5" />
            </motion.span>
            Launch MyCountry Builder
          </Button>
        </Link>
      </div>
      <p className="text-muted-foreground mx-auto mt-4 max-w-md text-xs leading-relaxed md:text-sm">
        The builder remembers you after sign-in. Preview it anytime.
      </p>
    </motion.div>
  );
}
