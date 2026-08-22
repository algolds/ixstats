"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Flame,
  Zap,
  Cpu,
  ShieldCheck,
  Search,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type ReleaseCategory = "all" | "feature" | "improvement" | "engine" | "fix";

export interface ReleaseItem {
  id: string;
  category: "feature" | "improvement" | "engine" | "fix";
  title: string;
  description: string;
  highlights?: string[];
  link?: { href: string; label: string };
}

export interface Release {
  version: string;
  releaseName: string;
  date: string;
  channel: string;
  isCurrent?: boolean;
  tagline: string;
  items: ReleaseItem[];
}

const CATEGORY_META: Record<
  ReleaseCategory,
  { label: string; icon: typeof Zap; color: string; badgeBg: string }
> = {
  all: {
    label: "All Updates",
    icon: Layers,
    color: "text-foreground",
    badgeBg: "bg-white/10 text-foreground",
  },
  feature: {
    label: "New Features",
    icon: Flame,
    color: "text-emerald-500 dark:text-emerald-400",
    badgeBg:
      "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  improvement: {
    label: "Improvements",
    icon: Zap,
    color: "text-blue-500 dark:text-blue-400",
    badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
  },
  engine: {
    label: "Platform & Engine",
    icon: Cpu,
    color: "text-purple-500 dark:text-purple-400",
    badgeBg:
      "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300",
  },
  fix: {
    label: "Fixes & Polish",
    icon: ShieldCheck,
    color: "text-amber-500 dark:text-amber-400",
    badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
  },
};

export function ChangelogFeed({ releases }: { releases: Release[] }) {
  const [selectedCategory, setSelectedCategory] = useState<ReleaseCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReleases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return releases
      .map((release) => {
        const items = release.items.filter((item) => {
          const matchesCategory =
            selectedCategory === "all" || item.category === selectedCategory;
          const matchesSearch =
            !q ||
            item.title.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.highlights?.some((h) => h.toLowerCase().includes(q));

          return matchesCategory && matchesSearch;
        });

        return {
          ...release,
          items,
        };
      })
      .filter((release) => release.items.length > 0);
  }, [releases, selectedCategory, searchQuery]);

  return (
    <>
      {/* Search & Category Filter Controls */}
      <div className="glass-surface border-border/40 mb-10 rounded-2xl border p-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search features, fixes, or engines…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-accent/10 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-accent/20 w-full rounded-xl border border-transparent py-2 pr-4 pl-9 text-xs transition-all focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(CATEGORY_META) as ReleaseCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/15 bg-transparent"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Release Timeline */}
      {filteredReleases.length === 0 ? (
        <div className="glass-surface border-border/30 rounded-2xl border p-12 text-center">
          <Search className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <h3 className="text-foreground mt-3 text-base font-semibold">No matching updates found</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Try adjusting your search keywords or switching category filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredReleases.map((release) => (
            <section key={release.version} className="relative">
              {/* Release Header */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-foreground text-2xl font-bold tracking-tight">
                      v{release.version}{" "}
                      <span className="text-muted-foreground font-semibold">"{release.releaseName}"</span>
                    </h2>
                    {release.isCurrent && (
                      <Badge className="rounded-full border-blue-500/30 bg-blue-500/15 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                        Latest Release
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed max-w-3xl">
                    {release.tagline}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{release.date}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-[11px]">Channel: {release.channel}</span>
                </div>
              </div>

              {/* Release Items Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {release.items.map((item) => {
                  const catMeta = CATEGORY_META[item.category];
                  const CatIcon = catMeta.icon;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group glass-surface border-border/40 hover:border-border/80 flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all duration-200 hover:shadow-md backdrop-blur-xl"
                    >
                      <div className="space-y-3">
                        {/* Item Category Header */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                              catMeta.badgeBg
                            )}
                          >
                            <CatIcon className="h-3 w-3" />
                            <span>{catMeta.label}</span>
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-foreground text-base font-bold tracking-tight">
                            {item.title}
                          </h3>
                          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {/* Bullet Highlights */}
                        {item.highlights && item.highlights.length > 0 && (
                          <div className="border-border/30 bg-accent/5 space-y-1.5 rounded-xl border p-3">
                            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                              Key Highlights
                            </span>
                            <ul className="space-y-1">
                              {item.highlights.map((highlight, idx) => (
                                <li
                                  key={idx}
                                  className="text-foreground/90 flex items-start gap-2 text-xs leading-snug"
                                >
                                  <CheckCircle2 className="text-primary/70 mt-0.5 h-3 w-3 shrink-0" />
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Optional Action Link */}
                      {item.link && (
                        <div className="mt-4 pt-3 border-t border-border/20">
                          <Link
                            href={item.link.href}
                            className="group/link text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                          >
                            <span>{item.link.label}</span>
                            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
