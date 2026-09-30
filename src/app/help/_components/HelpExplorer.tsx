"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Book,
  ChatBubble,
  Coins,
  Crown,
  Flask,
  Globe,
  Group as Users,
  NavArrowRight as ChevronRight,
  Page as FileText,
  Search,
  Settings,
  Shield,
  Sparks as Sparkles,
  StatUp as TrendingUp,
  Xmark,
} from "iconoir-react";
import {
  filterHelpSections,
  helpSections,
  type HelpSection,
  type HelpSectionIcon,
} from "../_lib/help-sections";

const SECTION_ICONS: Record<HelpSectionIcon, React.ElementType> = {
  sparkles: Sparkles,
  crown: Crown,
  trending: TrendingUp,
  users: Users,
  shield: Shield,
  globe: Globe,
  book: Book,
  coins: Coins,
  chat: ChatBubble,
  flask: Flask,
  settings: Settings,
};

const chipBase =
  "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-[color,background-color,border-color]";
const chipActive = "border-blue-500/50 bg-blue-500/15 text-blue-700 dark:text-blue-300";
const chipIdle =
  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10";

export function HelpExplorer({ sections = helpSections }: { sections?: HelpSection[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");

  const filteredSections = useMemo(
    () => filterHelpSections(sections, searchQuery, selectedSection),
    [sections, searchQuery, selectedSection]
  );
  const resultCount = filteredSections.reduce((sum, s) => sum + s.articles.length, 0);
  const isFiltering = searchQuery.trim() !== "" || selectedSection !== "all";

  return (
    <>
      {/* Search and section filter */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search the help center"
            placeholder="Search the help center (e.g. taxes, embassy, daily reward)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-4 pr-12 pl-12 text-slate-900 placeholder-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <Xmark className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <button
            type="button"
            aria-pressed={selectedSection === "all"}
            onClick={() => setSelectedSection("all")}
            className={`${chipBase} ${selectedSection === "all" ? chipActive : chipIdle}`}
          >
            <Book className="h-4 w-4" />
            All topics
          </button>
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.icon];
            const active = selectedSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedSection(active ? "all" : section.id)}
                className={`${chipBase} ${active ? chipActive : chipIdle}`}
              >
                <Icon className="h-4 w-4" />
                {section.title}
              </button>
            );
          })}
        </div>

        {isFiltering && (
          <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            {resultCount === 1 ? "1 article" : `${resultCount} articles`}
          </p>
        )}
      </div>

      {filteredSections.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-slate-400 dark:text-slate-600" />
          <h3 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-300">
            No articles match
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            Try a shorter word, or{" "}
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedSection("all");
              }}
              className="cursor-pointer font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              show every topic
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredSections.map((section) => {
            const Icon = SECTION_ICONS[section.icon];
            return (
              <section
                key={section.id}
                aria-labelledby={`help-section-${section.id}`}
                className={`rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5 ${
                  section.id === "getting-started" ? "lg:col-span-2" : ""
                }`}
              >
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-blue-500/15 p-2.5">
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2
                      id={`help-section-${section.id}`}
                      className="text-lg font-bold text-slate-900 dark:text-white"
                    >
                      {section.title}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {section.description}
                    </p>
                  </div>
                </div>

                <div
                  className={`grid gap-2 ${section.id === "getting-started" ? "md:grid-cols-2" : ""}`}
                >
                  {section.articles.map((article) => (
                    <Link
                      key={article.id}
                      href={article.path}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 transition-[color,background-color,border-color] hover:border-blue-500/50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
                          {article.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {article.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-[color,transform] group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
