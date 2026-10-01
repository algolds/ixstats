"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Bell,
  City as Building2,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Clock,
  Globe,
  Leaf,
  Pause,
  Play,
  ScaleFrameEnlarge as Scale,
  Shield,
  StatUp as TrendingUp,
  Group as Users,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { springSmooth } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";

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
    // oxlint-disable-next-line
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
        <h2 className={`text-large-title mb-2 ${splashGold.headline}`}>
          Some mail won&apos;t wait
        </h2>
        <p className="text-label-secondary text-body mx-auto max-w-xl leading-relaxed">
          National issues are live mail from the realm — choose a path, absorb the outcome, fold it
          back into canon. One clock for every capital; when a neighbor moves, your timeline already
          knows.
        </p>
      </div>

      <div
        className={
          "bg-surface border-separator rounded-card shadow-card mb-8 border p-4 md:flex md:items-center md:gap-4 md:p-5"
        }
      >
        <motion.div
          className={`mx-auto mb-3 flex h-10 w-10 shrink-0 items-center justify-center md:mx-0 md:mb-0 ${splashGold.iconWrapSm}`}
        >
          <Clock className="h-5 w-5" aria-hidden />
        </motion.div>
        <p className="text-label-secondary text-body md:text-body text-center leading-relaxed md:text-left">
          IxTime moves faster than the everyday clock — enough runway for arcs, not enough for
          endless waiting. Deadlines respect the shared calendar.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="rounded-row mx-auto min-h-56 max-w-2xl" />
      ) : issues.length === 0 ? (
        <p className="text-label-secondary text-body text-center leading-relaxed">
          Open issues will surface here as nations receive new mail — the realm is quiet for the
          moment.
        </p>
      ) : (
        <div
          className="relative mx-auto max-w-2xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Button
            type="button"
            variant="bordered"
            size="icon"
            aria-label="Previous issue"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-0 z-10 hidden -translate-x-1 -translate-y-1/2 rounded-full md:flex md:-translate-x-12"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="bordered"
            size="icon"
            aria-label="Next issue"
            onClick={() => go(1)}
            className="absolute top-1/2 right-0 z-10 hidden translate-x-1 -translate-y-1/2 rounded-full md:flex md:translate-x-12"
          >
            <ChevronRight aria-hidden />
          </Button>

          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="text-label-secondary text-footnote tabular-nums">
              {index + 1} / {issues.length}
            </span>
            <Button
              type="button"
              variant="gray"
              size="icon-sm"
              className="rounded-full"
              aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            </Button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={springSmooth}
                className="border-separator bg-surface rounded-card shadow-card min-h-52 border p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {current.country.flag ? (
                      <span className="border-separator bg-fill-3 rounded-control-sm relative h-10 w-10 shrink-0 overflow-hidden border">
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
                  <Badge variant="tinted">{formatSeverityLabel(current.severity)}</Badge>
                </div>
                <p className="text-label-secondary text-eyebrow mb-1">
                  {current.country.name.replace(/_/g, " ")}
                </p>
                <h3 className="text-label text-title-3 mb-2">{current.title}</h3>
                <p className="text-label-secondary text-body leading-relaxed">
                  {teaserFromDescription(current.description, 280)}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 px-2">
            {issues.map((iss: any, i: number) => (
              <button
                key={iss.id}
                type="button"
                aria-label={`Go to issue ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-300",
                  i === index ? "bg-tint w-7" : "bg-label-tertiary hover:bg-label-secondary w-1.5"
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-2 md:hidden">
            <Button
              type="button"
              variant="bordered"
              size="icon"
              className="rounded-full"
              aria-label="Previous issue"
              onClick={() => go(-1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              type="button"
              variant="bordered"
              size="icon"
              className="rounded-full"
              aria-label="Next issue"
              onClick={() => go(1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <p className="text-label-secondary text-body mt-8 text-center">
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
