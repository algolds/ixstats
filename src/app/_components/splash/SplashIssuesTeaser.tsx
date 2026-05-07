"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Leaf,
  Pause,
  Play,
  Scale,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const DOMAIN_ICON: Record<string, typeof Scale> = {
  economic: TrendingUp,
  political: Scale,
  social: Users,
  military: Shield,
  diplomatic: Globe,
  infrastructure: Building2,
  environmental: Leaf,
};

const AUTO_MS = 6500;

function formatSeverityLabel(severity: string) {
  const x = severity.toLowerCase();
  if (x === "critical") return "Critical";
  if (x === "high") return "High";
  if (x === "medium") return "Medium";
  if (x === "low") return "Low";
  return severity;
}

function teaserFromDescription(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function SplashIssuesTeaser() {
  const { data, isLoading } = api.nationalIssues.getRecentWorldIssues.useQuery(
    { limit: 18 },
    {
      staleTime: 0,
      gcTime: 5 * 60_000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }
  );

  const issues = data?.issues ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [issues.length]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (issues.length === 0) return;
      setIndex((i) => (i + dir + issues.length) % issues.length);
    },
    [issues.length]
  );

  useEffect(() => {
    if (issues.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % issues.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [issues.length, paused]);

  const current = issues[index];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65 }}
      className="mx-auto mb-16 max-w-7xl md:mb-20"
    >
      <div className="mb-8 text-center">
        <h2 className={`mb-2 text-3xl font-bold tracking-tight md:text-4xl ${splashGold.headline}`}>
          Some mail won&apos;t wait
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xl text-base leading-relaxed">
          National issues are live mail from the realm — choose a path, absorb the outcome, fold it back into canon.
          One clock for every capital; when a neighbor moves, your timeline already knows.
        </p>
      </div>

      <div
        className={`glass-hierarchy-parent mb-8 rounded-2xl p-4 md:flex md:items-center md:gap-4 md:p-5 ${splashGold.subtlePanel}`}
      >
        <motion.div
          className={`mx-auto mb-3 flex h-10 w-10 shrink-0 items-center justify-center md:mx-0 md:mb-0 ${splashGold.iconWrapSm}`}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Clock className="h-5 w-5 text-white" aria-hidden />
        </motion.div>
        <p className="text-muted-foreground text-center text-sm leading-relaxed md:text-left md:text-base">
          IxTime moves faster than the everyday clock — enough runway for arcs, not enough for endless waiting. Deadlines
          respect the shared calendar.
        </p>
      </div>

      {isLoading ? (
        <div className={`mx-auto min-h-[220px] max-w-2xl animate-pulse rounded-xl ${splashGold.subtlePanel}`} />
      ) : issues.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm leading-relaxed">
          Open issues will surface here as nations receive new mail — the realm is quiet for the moment.
        </p>
      ) : (
        <div
          className="relative mx-auto max-w-2xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <button
            type="button"
            aria-label="Previous issue"
            onClick={() => go(-1)}
            className="border-border bg-background/80 text-foreground hover:bg-muted absolute top-1/2 left-0 z-10 hidden h-10 w-10 -translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm md:flex md:-translate-x-12"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next issue"
            onClick={() => go(1)}
            className="border-border bg-background/80 text-foreground hover:bg-muted absolute top-1/2 right-0 z-10 hidden h-10 w-10 translate-x-1 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm md:flex md:translate-x-12"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="text-muted-foreground text-xs tabular-nums">
              {index + 1} / {issues.length}
            </span>
            <button
              type="button"
              aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
              onClick={() => setPaused((p) => !p)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted",
                splashGold.border
              )}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`glass-hierarchy-child min-h-[200px] rounded-xl border bg-card/30 p-5 dark:bg-card/15 ${splashGold.border} ${splashGold.darkBorder}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {current.country.flag ? (
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        <img
                          src={current.country.flag}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                    ) : null}
                    {(() => {
                      const domainKey = current.domain?.toLowerCase() ?? "";
                      const Icon = DOMAIN_ICON[domainKey] ?? Bell;
                      return <Icon className={`h-5 w-5 shrink-0 ${splashGold.text}`} aria-hidden />;
                    })()}
                  </div>
                  <Badge className={`text-[10px] ${splashGold.badge}`}>
                    {formatSeverityLabel(current.severity)}
                  </Badge>
                </div>
                <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                  {current.country.name.replace(/_/g, " ")}
                </p>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{current.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {teaserFromDescription(current.description, 280)}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 px-2">
            {issues.map((iss, i) => (
              <button
                key={iss.id}
                type="button"
                aria-label={`Go to issue ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-7 bg-amber-500 opacity-95 dark:bg-amber-400"
                    : "w-1.5 bg-muted-foreground/35 hover:bg-muted-foreground/55"
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-2 md:hidden">
            <button
              type="button"
              aria-label="Previous issue"
              onClick={() => go(-1)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted",
                splashGold.border
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next issue"
              onClick={() => go(1)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted",
                splashGold.border
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <p className="text-muted-foreground mt-8 text-center text-sm">
        <Link href="/help/gameplay/national-issues" className={splashGold.link}>
          How issues work
        </Link>
        {" · "}
        <Link href="/help/gameplay/country-building" className={splashGold.link}>
          Nation building guide
        </Link>
      </p>
    </motion.section>
  );
}
