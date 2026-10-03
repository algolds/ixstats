"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  FireFlame as Flame,
  Flash as Zap,
  Cpu,
  ShieldCheck,
  Search,
  Calendar,
  CheckCircle as CheckCircle2,
  NavArrowRight as ChevronRight,
  Component as Layers,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
    label: "All updates",
    icon: Layers,
    color: "text-label",
    badgeBg: "bg-fill-3 text-label",
  },
  feature: {
    label: "New features",
    icon: Flame,
    color: "text-green",
    badgeBg: "bg-green/15 border-green/30 text-green",
  },
  improvement: {
    label: "Improvements",
    icon: Zap,
    color: "text-blue",
    badgeBg: "bg-blue/15 border-blue/30 text-blue",
  },
  engine: {
    label: "Platform and engine",
    icon: Cpu,
    color: "text-purple",
    badgeBg: "bg-purple/15 border-purple/30 text-purple",
  },
  fix: {
    label: "Fixes",
    icon: ShieldCheck,
    color: "text-yellow",
    badgeBg: "bg-yellow/15 border-yellow/30 text-yellow",
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
          const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
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
      {/* Search and category filter */}
      <Card className="mb-10 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search Input */}
          <SearchField
            containerClassName="flex-1"
            aria-label="Search the changelog"
            placeholder="Search the changelog"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />

          {/* Category Filter */}
          <SegmentedControl
            aria-label="Release category"
            size="sm"
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            options={(Object.keys(CATEGORY_META) as ReleaseCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              return { value: cat, label: meta.label, icon: <Icon aria-hidden /> };
            })}
          />
        </div>
      </Card>

      {/* Release Timeline */}
      {filteredReleases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search />}
            title="No matching updates"
            message="Change the search or pick another category."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
              >
                Reset filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-12">
          {filteredReleases.map((release) => (
            <section key={release.version} className="relative">
              {/* Release Header */}
              <div className="border-separator mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-label text-title-1">
                      v{release.version}{" "}
                      <span className="text-label-secondary font-semibold">
                        "{release.releaseName}"
                      </span>
                    </h2>
                    {release.isCurrent && <Badge variant="info">Latest release</Badge>}
                  </div>
                  <p className="text-label-secondary text-footnote max-w-3xl leading-relaxed">
                    {release.tagline}
                  </p>
                </div>

                <div className="text-label-secondary text-caption flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{release.date}</span>
                  <span className="text-label-tertiary">·</span>
                  <span className="text-footnote">Channel: {release.channel}</span>
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
                      className="group bg-surface border-separator hover:border-separator rounded-card shadow-card hover:shadow-card flex flex-col justify-between border p-5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
                    >
                      <div className="space-y-3">
                        {/* Item Category Header */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "rounded-control-sm text-eyebrow inline-flex items-center gap-2 border px-2 py-0.5",
                              catMeta.badgeBg
                            )}
                          >
                            <CatIcon className="h-3 w-3" />
                            <span>{catMeta.label}</span>
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-label text-headline">{item.title}</h3>
                          <p className="text-label-secondary text-footnote mt-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {/* Bullet Highlights */}
                        {item.highlights && item.highlights.length > 0 && (
                          <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
                            <span className="text-label-secondary text-eyebrow">Highlights</span>
                            <ul className="space-y-1">
                              {item.highlights.map((highlight, idx) => (
                                <li
                                  key={idx}
                                  className="text-label/90 text-footnote flex items-start gap-2 leading-snug"
                                >
                                  <CheckCircle2 className="text-tint/70 mt-0.5 h-3 w-3 shrink-0" />
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Optional Action Link */}
                      {item.link && (
                        <div className="border-separator mt-4 border-t pt-3">
                          <Link
                            href={item.link.href}
                            className="group/link text-tint hover:text-tint/80 text-caption inline-flex items-center gap-2 font-semibold transition-colors"
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
