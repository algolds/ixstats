"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  BookOpen,
  Globe,
  MessageSquare,
  TrendingUp,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { Marquee } from "~/components/ui/magicui/marquee";
import { api } from "~/trpc/react";
import { splashGold } from "~/lib/splash/mycountry-gold";

const typeIcon: Record<string, typeof Trophy> = {
  achievement: Trophy,
  diplomatic: Globe,
  economic: TrendingUp,
  social: MessageSquare,
  meta: Activity,
};

type FeedUser = { countryFlag?: string | null } | null | undefined;

function feedKindLabel(item: { source?: string; type?: string }) {
  if (item.source === "thinkpages") return "ThinkPages";
  if (item.source === "wiki") return "Wiki";
  if (item.source === "forum") return "Forum";
  const t = item.type ?? "";
  if (t === "achievement") return "Achievement";
  if (t === "diplomatic") return "Diplomacy";
  if (t === "economic") return "Economy";
  if (t === "social") return "Social";
  if (t === "meta") return "Platform";
  return "IxStats";
}

export function SplashLiveFeed() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading } = api.activities.getGlobalFeed.useQuery(
    { limit: 48, filter: "all", category: "all" },
    { staleTime: 60_000, refetchInterval: 120_000 }
  );

  const items = useMemo(() => {
    const acts = data?.activities ?? [];
    return acts.map((a) => {
      const user = a.user as FeedUser;
      return {
        id: a.id,
        type: String(a.type),
        source: String((a as { source?: string }).source ?? "activity"),
        title: String(a.content?.title ?? "").slice(0, 120),
        ts: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp as string),
        countryFlag: user?.countryFlag ?? null,
      };
    });
  }, [data]);

  const loopItems = items.length > 0 ? [...items, ...items] : [];

  if (!isLoading && items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto mb-14 max-w-7xl md:mb-16"
    >
      <div className="mb-5 text-center">
        <h2 className={`text-lg font-semibold tracking-tight md:text-xl ${splashGold.headline}`}>
          Happening now
        </h2>
        <p className="text-muted-foreground mx-auto mt-1 max-w-lg text-sm leading-relaxed">
          Real updates, same stream as your dashboard—ThinkPages, wiki edits, achievements, forum,
          and public notices.
        </p>
      </div>

      {isLoading || !mounted ? (
        <div
          className={`mx-auto h-14 max-w-4xl animate-pulse rounded-xl ${splashGold.subtlePanel}`}
        />
      ) : (
        <div
          className={`overflow-hidden rounded-xl border bg-amber-500/[0.02] dark:bg-amber-950/15 ${splashGold.border} ${splashGold.darkBorder}`}
        >
          <Marquee pauseOnHover className="py-3 [--duration:220s]">
            {loopItems.map((item, idx) => {
              const Icon = item.source === "wiki" ? BookOpen : (typeIcon[item.type] ?? Activity);
              const kind = feedKindLabel({ source: item.source, type: item.type });
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="mr-10 flex max-w-[min(100vw-3rem,420px)] shrink-0 items-start gap-3 sm:mr-14 sm:max-w-none"
                >
                  <motion.div
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden md:h-10 md:w-10 ${
                      item.countryFlag
                        ? "bg-muted rounded-md border border-amber-500/25 dark:border-amber-400/20"
                        : splashGold.iconWrapSm
                    }`}
                    animate={{ y: [0, -2, 0] }}
                    transition={{
                      duration: 2.8 + (idx % 5) * 0.12,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {item.countryFlag ? (
                      <img
                        src={item.countryFlag}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="relative z-[1] h-4 w-4 text-white" aria-hidden />
                    )}
                  </motion.div>
                  <div className="min-w-0 text-left">
                    <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      {kind}
                    </p>
                    <p className="text-foreground line-clamp-2 text-xs leading-snug font-medium sm:text-sm">
                      {item.title || "Activity"}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[10px] tabular-nums sm:text-xs">
                      {formatDistanceToNow(item.ts, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </Marquee>
        </div>
      )}

      <p className="text-muted-foreground mt-4 text-center text-xs">
        <Link href="/feed" className={`inline-flex items-center gap-1 ${splashGold.link}`}>
          Full feed
          <ChevronRight className="h-3 w-3" />
        </Link>
      </p>
    </motion.section>
  );
}
