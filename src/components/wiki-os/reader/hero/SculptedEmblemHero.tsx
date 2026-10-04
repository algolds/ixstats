"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  ChatBubble as MessageSquare,
  ArrowUpRight,
  ArrowRight,
  User,
  ClockRotateRight as History,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  LightBulb as Lightbulb,
  Trophy as IconoirTrophy,
  OpenBook as IconoirOpenBook,
  Folder as IconoirFolder,
} from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { IxWikiLogo } from "~/components/wiki-os/shared/IxWikiLogo";
import { IxWikiWordmark } from "~/components/wiki-os/shared/IxWikiWordmark";
import { HeroSpotlightSearch } from "./HeroSpotlightSearch";
import { FeaturedArticleCard, FeaturedThumbnailFrame } from "./FeaturedArticle";
import type { WikiHeroProps } from "./types";
import { Button } from "~/components/ui/button";

const CANON_CHRONICLE_EVENTS = [
  {
    year: "1919",
    title: "League of Nations",
    description: "Universal covenant for international diplomacy and global peacekeeping.",
    slug: "League_of_Nations",
  },
  {
    year: "1904",
    title: "The Great War",
    description: "Global conflict that reshaped continental borders and sovereign doctrine.",
    slug: "Great_War",
  },
  {
    year: "1882",
    title: "First Gothic War",
    description: "Strategic conflict establishing northern spheres and maritime navigation.",
    slug: "First_Gothic_War",
  },
  {
    year: "1984",
    title: "Assumption Accords",
    description:
      "The Framework for Peaceful Co-Existence on Urlazio and Sarpedon, more commonly known as the Assumption Accords, was an agreement reached by the governments of Caphiria and Urcea, settling long standing disputes over territorial boundaries on Urlazio as well as geopolitical and legal claims in Sarpedon.",
    slug: "Assumption_Accords",
  },
  {
    year: "2008",
    title: "The Deluge",
    description:
      "The Deluge describes a series of conflicts and geopolitical tumult that occurred in northern and central Crona from 2008 through 2024.",
    slug: "The_Deluge",
  },
  {
    year: "1387",
    title: "Aster's expedition",
    description:
      "Aster's expedition was a naval expedition launched in the 1380s on behalf of Ardmore and lead by Ænglish mariner Paul Aster.",
    slug: "Aster's_expedition",
  },
];

export function SculptedEmblemHero({
  siteStats,
  activePrompt,
  featuredArticleHtml,
  featuredArticleData,
  onOpenBlurbs,
}: WikiHeroProps) {
  const [chronicleIndex, setChronicleIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const articleCountStr = siteStats?.articles
    ? `${siteStats.articles.toLocaleString()}+`
    : "1,400+";

  const searchPlaceholders = useMemo(
    () => [`Search ${articleCountStr} articles...`],
    [articleCountStr]
  );

  return (
    <section
      aria-label="WikiOS sculpted emblem hero"
      className="relative flex w-full flex-col items-center justify-center pt-1 pb-2 text-center select-none sm:pb-3"
    >
      <Link
        href={withBasePath("/wiki/Main_Page")}
        aria-label="IxWiki home"
        className="group/brand rounded-card focus-visible:outline-tint mb-1 flex cursor-pointer flex-col items-center justify-center text-center outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <motion.div
          whileHover={reduceMotion ? {} : { scale: 1.04, y: -2 }}
          whileTap={reduceMotion ? {} : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
          className="relative mb-2 flex items-center justify-center sm:mb-3"
        >
          {/* The Canonical Laurel Sphere Logo - Sculpted Emblem View */}
          <IxWikiLogo
            size={96}
            className="wikios-brand-mark relative z-10 h-22 w-22 transition-transform duration-300 ease-out motion-safe:group-hover/brand:scale-[1.03] motion-safe:group-focus-visible/brand:scale-[1.03] motion-reduce:transition-none sm:h-26 sm:w-26 lg:h-28 lg:w-28"
          />
        </motion.div>

        {/* Typographic Wordmark & Subtitle */}
        <div className="flex max-w-xl flex-col items-center justify-center gap-1 px-4">
          <IxWikiWordmark
            size="hero"
            className="group-hover/brand:text-label group-focus-visible/brand:text-label leading-none transition-colors"
          />
          <div className="mt-2 flex items-center justify-center">
            <span className="text-label-secondary text-eyebrow sm:text-footnote leading-none">
              Worldbuilding encyclopedia
            </span>
          </div>
        </div>
      </Link>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-30 mt-3 w-full max-w-xl px-4 sm:mt-4"
      >
        <HeroSpotlightSearch placeholderHints={searchPlaceholders} />
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full flex-wrap items-center justify-center gap-2 pt-1 pb-2 sm:gap-2"
      >
        {/* Action 1: Award-Winning Lore */}
        <Link
          href={withBasePath("/wiki/category:featured_articles")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "text-caption flex cursor-pointer items-center gap-2 rounded-full px-3 py-1",
            "facet-chrome border-separator border",
            "hover:border-yellow/40 hover:bg-yellow/6",
            "text-label-secondary hover:text-label group focus-visible:ring-tint focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <IconoirTrophy
            aria-hidden="true"
            className="text-yellow h-3.5 w-3.5 transition-transform motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
          />
          <span>Award-Winning Lore</span>
        </Link>

        {/* Action 2: Getting Started */}
        <Link
          href={withBasePath("/wiki/IxWiki:Getting_Started")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "text-caption flex cursor-pointer items-center gap-2 rounded-full px-3 py-1",
            "facet-chrome border-separator border",
            "hover:border-tint/40 hover:bg-tint-fill",
            "text-label-secondary hover:text-label group focus-visible:ring-tint focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <IconoirOpenBook
            aria-hidden="true"
            className="text-tint h-3.5 w-3.5 transition-transform motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
          />
          <span>Getting started</span>
        </Link>

        {/* Action 3: Resources */}
        <Link
          href={withBasePath("/wiki/repository")}
          data-cuelume-press="press"
          data-cuelume-hover="tick"
          className={cn(
            "text-caption flex cursor-pointer items-center gap-2 rounded-full px-3 py-1",
            "facet-chrome border-separator border",
            "hover:border-green/40 hover:bg-green/6",
            "text-label-secondary hover:text-label group focus-visible:ring-tint focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <IconoirFolder
            aria-hidden="true"
            className="text-green h-3.5 w-3.5 transition-transform motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
          />
          <span>Resources</span>
        </Link>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
        className="relative z-10 mt-4 grid w-full max-w-6xl grid-cols-1 gap-2 px-4 sm:mt-5 sm:gap-3 md:grid-cols-2"
      >
        {/* Tile: Timeline (Milestones & Canon Historical Events) */}
        <div
          className={cn(
            "rounded-card relative flex min-h-[82px] flex-col justify-between overflow-hidden p-3 sm:min-h-[86px] sm:p-4",
            "bg-surface border-separator shadow-card border",
            "group text-left"
          )}
        >
          <div className="mb-1 flex w-full items-center justify-between">
            <span className="text-eyebrow text-yellow-ink flex items-center gap-2">
              <History aria-hidden="true" className="text-yellow h-3.5 w-3.5" /> Timeline
            </span>
            {/* stepper pill */}
            <div className="rounded-control-sm border-separator bg-fill-4 flex items-center gap-0.5 border px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setChronicleIndex((prev) =>
                    prev === 0 ? CANON_CHRONICLE_EVENTS.length - 1 : prev - 1
                  );
                }}
                aria-label="Previous historical event"
                className="text-label-secondary size-6"
              >
                <ChevronLeft aria-hidden="true" className="h-3 w-3" />
              </Button>
              <span className="text-label-secondary text-caption px-1 tabular-nums select-none">
                {chronicleIndex + 1}/{CANON_CHRONICLE_EVENTS.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setChronicleIndex((prev) => (prev + 1) % CANON_CHRONICLE_EVENTS.length);
                }}
                aria-label="Next historical event"
                className="text-label-secondary size-6"
              >
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
              </Button>
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
                  className="group/event rounded-control-sm focus-visible:outline-tint facet-press-subtle block outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="py-0.2 rounded-control-sm border-yellow/20 bg-yellow/10 text-caption text-yellow-ink shrink-0 border px-2 font-semibold tabular-nums">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].year}
                    </span>
                    <span className="text-label text-caption group-hover/event:text-yellow-ink group-focus-visible/event:text-yellow-ink sm:text-callout truncate leading-tight font-semibold transition-colors">
                      {CANON_CHRONICLE_EVENTS[chronicleIndex].title}
                    </span>
                  </div>
                  <span className="text-label-secondary text-caption mt-0.5 line-clamp-1 block leading-snug">
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
              "rounded-card relative flex min-h-[82px] flex-col justify-between overflow-hidden p-3 sm:min-h-[86px] sm:p-4",
              "bg-surface border-separator shadow-card facet-lift border",
              "group facet-press facet-press-subtle cursor-pointer text-left"
            )}
          >
            <div className="mb-1 flex w-full items-center justify-between">
              <span className="text-eyebrow text-tint flex items-center gap-2">
                <MessageSquare aria-hidden="true" className="text-tint h-3.5 w-3.5" /> Blurb of the
                Week
              </span>
              <div className="flex items-center gap-1">
                {activePrompt._count?.responses !== undefined &&
                activePrompt._count.responses > 0 ? (
                  <span className="border-tint/20 bg-tint/10 text-caption text-tint group-hover:border-tint/30 group-hover:bg-tint/20 group-focus-visible:border-tint/30 group-focus-visible:bg-tint/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200">
                    <span className="tabular-nums">{activePrompt._count.responses}</span>
                    <span className="opacity-75">
                      {activePrompt._count.responses === 1 ? "response" : "responses"}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-2.5 w-2.5 opacity-60 transition-[opacity,translate] duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:translate-x-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
                    />
                  </span>
                ) : (
                  <span className="border-tint/20 bg-tint/10 text-caption text-tint group-hover:border-tint/30 group-hover:bg-tint/20 group-focus-visible:border-tint/30 group-focus-visible:bg-tint/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200">
                    <span>Respond now</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-2.5 w-2.5 opacity-60 transition-[opacity,translate] duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:translate-x-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
                    />
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="text-label group-hover:text-label text-caption sm:text-callout block truncate leading-tight font-semibold transition-colors">
                {activePrompt.title}
              </span>
              <span className="text-label-secondary text-caption mt-0.5 block truncate">
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
              "rounded-card relative flex min-h-[82px] flex-col justify-between overflow-hidden p-3 sm:min-h-[86px] sm:p-4",
              "bg-surface border-separator shadow-card facet-lift border",
              "group facet-press facet-press-subtle cursor-pointer text-left"
            )}
          >
            <div className="mb-1 flex w-full items-center justify-between">
              <span className="text-eyebrow text-tint flex items-center gap-2">
                <MessageSquare aria-hidden="true" className="text-tint h-3.5 w-3.5" /> Blurb of the
                Week
              </span>
              <span className="border-tint/20 bg-tint/10 text-caption text-tint group-hover:border-tint/30 group-hover:bg-tint/20 group-focus-visible:border-tint/30 group-focus-visible:bg-tint/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200">
                <span>View prompts</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-2.5 w-2.5 opacity-60 transition-[opacity,translate] duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:translate-x-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
                />
              </span>
            </div>
            <div>
              <span className="text-label group-hover:text-label text-caption sm:text-callout block truncate leading-tight font-semibold transition-colors">
                Worldbuilding prompts
              </span>
              <span className="text-label-secondary text-caption mt-0.5 block truncate">
                Share your nation's perspective
              </span>
            </div>
          </button>
        )}
      </motion.div>

      {(featuredArticleData || featuredArticleHtml) && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="relative z-10 mt-4 w-full text-left sm:mt-5"
        >
          <FeaturedArticleCard>
            {/* Top bar */}
            <div className="relative z-10 mb-4 flex items-center justify-between gap-2 sm:mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="border-yellow/20 bg-yellow/10 text-caption text-yellow-ink inline-flex items-center gap-2 rounded-full border px-3 py-0.5 font-semibold">
                  <Star aria-hidden="true" className="fill-yellow text-yellow h-3.5 w-3.5" />
                  <span>Featured article</span>
                </div>
                {/* Live Author / Editorial Byline */}
                {(() => {
                  const creator = featuredArticleData?.authorInfo?.creator;
                  const creatorName =
                    typeof creator === "object" ? (creator as any)?.username : creator;
                  if (!creatorName) return null;
                  return (
                    <div className="text-label-secondary text-caption hidden items-center gap-2 sm:flex">
                      <span className="text-label-secondary select-none">·</span>
                      <span className="flex items-center gap-1">
                        {featuredArticleData?.authorInfo?.creatorAvatar ? (
                          <img
                            src={featuredArticleData.authorInfo.creatorAvatar}
                            alt={creatorName}
                            className="border-separator h-3.5 w-3.5 rounded-full border object-cover"
                          />
                        ) : (
                          <User aria-hidden="true" className="text-label-secondary h-3 w-3" />
                        )}
                        <span>
                          By <strong className="text-label font-semibold">{creatorName}</strong>
                        </span>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Archive & Suggest Links */}
              <div className="text-label-secondary text-footnote flex items-center gap-2">
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_articles")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="hover:text-label text-caption flex items-center gap-1 transition-colors"
                >
                  <History aria-hidden="true" className="h-3 w-3" />
                  <span>Archive</span>
                </Link>
                <span className="text-label-secondary select-none">·</span>
                <Link
                  href={withBasePath("/wiki/IxWiki:Featured_article_candidates")}
                  data-cuelume-press="page"
                  data-cuelume-hover="tick"
                  className="text-caption hover:text-yellow-ink focus-visible:text-yellow-ink flex items-center gap-1 transition-colors"
                >
                  <Lightbulb aria-hidden="true" className="h-3 w-3" />
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
                      className="group/title rounded-control-sm focus-visible:ring-tint block focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <h3 className="text-label text-title-3 group-hover/title:text-yellow-ink group-focus-visible/title:text-yellow-ink sm:text-title-2 lg:text-title-1 transition-colors">
                        {featuredArticleData.title}
                      </h3>
                    </Link>
                    <p className="text-label-secondary text-footnote sm:text-callout mt-2 line-clamp-3 leading-relaxed font-normal">
                      {featuredArticleData.summary}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3 sm:mt-4">
                    <Link
                      href={withBasePath(`/wiki/${featuredArticleData.slug}`)}
                      data-cuelume-press="droplet"
                      data-cuelume-hover="tick"
                      className="text-label group/cta text-caption hover:text-yellow-ink focus-visible:text-yellow-ink inline-flex items-center gap-2 font-semibold transition-colors"
                    >
                      <span>Read full article</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform motion-safe:group-hover/cta:translate-x-1 motion-safe:group-focus-visible/cta:translate-x-1"
                      />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="wikios-main-featured-content wikios-article-content text-body relative z-10 text-left leading-relaxed"
                dangerouslySetInnerHTML={{ __html: featuredArticleHtml ?? "" }}
              />
            )}
          </FeaturedArticleCard>
        </motion.div>
      )}
    </section>
  );
}
