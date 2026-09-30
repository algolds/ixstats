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
  Compass,
  StatUp as TrendingUp,
  Xmark,
} from "iconoir-react";
import {
  filterHelpSections,
  helpSections,
  type HelpSection,
  type HelpSectionIcon,
} from "../_lib/help-sections";
import { Button } from "~/components/ui/button";
import {
  FacetCard,
  FacetCardContent,
  FacetCardHeader,
  FacetContainer,
} from "~/components/ui/facet-container";
import { Input } from "~/components/ui/input";
import { Toggle } from "~/components/ui/toggle";
import { cn } from "~/lib/utils";

const SECTION_ICONS: Record<HelpSectionIcon, React.ElementType> = {
  sparkles: Compass,
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
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Search the help center"
            placeholder="Search the help center (e.g. taxes, embassy, daily reward)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="facet-refraction-none h-12 rounded-xl pr-12 pl-12 text-base"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2"
            >
              <Xmark aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <Toggle
            variant="outline"
            pressed={selectedSection === "all"}
            onPressedChange={() => setSelectedSection("all")}
            className="px-3"
          >
            <Book aria-hidden="true" />
            All topics
          </Toggle>
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.icon];
            const active = selectedSection === section.id;
            return (
              <Toggle
                key={section.id}
                variant="outline"
                pressed={active}
                onPressedChange={() => setSelectedSection(active ? "all" : section.id)}
                className="px-3"
              >
                <Icon aria-hidden="true" />
                {section.title}
              </Toggle>
            );
          })}
        </div>

        {isFiltering && (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {resultCount === 1 ? "1 article" : `${resultCount} articles`}
          </p>
        )}
      </div>

      {filteredSections.length === 0 ? (
        <div className="py-12 text-center">
          <FileText aria-hidden="true" className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-semibold">No articles match</h3>
          <p className="text-muted-foreground">
            Try a shorter word, or{" "}
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setSelectedSection("all");
              }}
              className="h-auto p-0 text-base"
            >
              show every topic
            </Button>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredSections.map((section) => {
            const Icon = SECTION_ICONS[section.icon];
            const isLead = section.id === "getting-started";
            return (
              <FacetCard
                key={section.id}
                depth={2}
                role="region"
                aria-labelledby={`help-section-${section.id}`}
                className={cn("rounded-2xl", isLead && "lg:col-span-2")}
              >
                <FacetCardHeader className="flex-row items-start gap-3 p-5 pb-4">
                  <Icon
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
                  />
                  <div className="flex-1">
                    <h2
                      id={`help-section-${section.id}`}
                      className="text-foreground text-base font-semibold"
                    >
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">{section.description}</p>
                  </div>
                </FacetCardHeader>

                <FacetCardContent
                  className={cn("grid gap-2 px-5 pb-5", isLead && "md:grid-cols-2")}
                >
                  {section.articles.map((article) => (
                    <Link
                      key={article.id}
                      href={article.path}
                      data-cuelume-press="tick"
                      className="group focus-visible:ring-ring rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <FacetContainer
                        depth={3}
                        surface="solid"
                        className="group-hover:bg-accent flex min-h-11 items-center justify-between gap-3 rounded-lg p-3.5 transition-[background-color] duration-150"
                      >
                        <div className="flex-1">
                          <h3 className="text-foreground text-sm font-semibold">{article.title}</h3>
                          <p className="text-muted-foreground text-sm">{article.description}</p>
                        </div>
                        <ChevronRight
                          aria-hidden="true"
                          className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-[color,transform] duration-150 group-hover:translate-x-0.5"
                        />
                      </FacetContainer>
                    </Link>
                  ))}
                </FacetCardContent>
              </FacetCard>
            );
          })}
        </div>
      )}
    </>
  );
}
