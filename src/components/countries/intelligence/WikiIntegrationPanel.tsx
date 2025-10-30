"use client";

// Wiki Integration Panel - Displays wiki data integration
// Refactored from EnhancedIntelligenceBriefing.tsx

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { parseWikiContent } from "./utils";
import { ClassificationBadge } from "./StatusIndicators";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { RiExternalLinkLine, RiEditLine, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";
import { cn } from "~/lib/utils";
import type { WikiIntelligenceData, CountryData } from "./types";

export interface WikiIntegrationPanelProps {
  wikiData?: WikiIntelligenceData;
  country: CountryData;
  isLoading?: boolean;
  onSaveOverview?: (content: string) => void;
  className?: string;
}

export const WikiIntegrationPanel: React.FC<WikiIntegrationPanelProps> = ({
  wikiData,
  country,
  isLoading = false,
  onSaveOverview,
  className,
}) => {
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState("");

  const handleWikiLinkClick = useCallback((link: string) => {
    if (link.startsWith("http")) {
      window.open(link, "_blank");
    } else {
      window.open(`https://ixwiki.com/wiki/${encodeURIComponent(link)}`, "_blank");
    }
  }, []);

  const handleSave = useCallback(() => {
    if (editorContent.trim() && onSaveOverview) {
      onSaveOverview(editorContent.trim());
      setShowEditor(false);
      setEditorContent("");
    }
  }, [editorContent, onSaveOverview]);

  if (isLoading) {
    return (
      <Card className={cn("glass-hierarchy-child", className)}>
        <CardContent className="py-12">
          <LoadingState variant="spinner" message="Loading wiki intelligence data..." />
        </CardContent>
      </Card>
    );
  }

  const overviewSection = wikiData?.sections?.find((section) => section.id === "overview");

  return (
    <Card className={cn("glass-hierarchy-child relative overflow-hidden", className)}>
      {/* Flag Background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]">
        {wikiData?.infobox?.image_flag || wikiData?.infobox?.flag ? (
          <img
            src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_flag || wikiData.infobox.flag}`}
            alt="Flag background"
            className="h-full w-full object-cover object-center blur-sm"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UnifiedCountryFlag countryName={country.name} size="xl" />
          </div>
        )}
        <div className="from-background/75 via-background/50 to-background/75 absolute inset-0 bg-gradient-to-r"></div>
      </div>

      <CardHeader className="relative z-10">
        <CardTitle>Strategic Intelligence Overview</CardTitle>
      </CardHeader>

      <CardContent className="relative z-10">
        <div className="space-y-6">
          {/* Coat of Arms */}
          {(wikiData?.infobox?.image_coat || wikiData?.infobox?.coat_of_arms) && (
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex-1"></div>
              <Dialog>
                <DialogTrigger asChild>
                  <div className="group cursor-pointer">
                    <div className="relative rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 backdrop-blur-sm transition-all duration-300 group-hover:border-amber-400/50">
                      <img
                        src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms}`}
                        alt="Coat of Arms"
                        className="h-16 w-16 rounded object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-amber-400"></div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-medium text-amber-400">Coat of Arms</div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Coat of Arms - {country.name}</DialogTitle>
                  </DialogHeader>
                  <div className="flex justify-center p-4">
                    <img
                      src={`https://ixwiki.com/wiki/Special:Filepath/${wikiData.infobox.image_coat || wikiData.infobox.coat_of_arms}`}
                      alt="Coat of Arms"
                      className="max-h-96 max-w-full rounded-lg object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <div className="text-muted-foreground text-center text-sm">
                    Official coat of arms of {country.name}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Overview Text */}
          {!overviewSection ? (
            // Fallback content when no wiki data
            <div className="space-y-4">
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                <div className="text-muted-foreground">
                  {country.name} is a {country.governmentType || "sovereign"} nation located in{" "}
                  {country.continent || "an undisclosed region"}. With a population of{" "}
                  {country.currentPopulation.toLocaleString()} citizens and a GDP per capita of $
                  {country.currentGdpPerCapita.toLocaleString()}, the country operates as a{" "}
                  {country.economicTier.toLowerCase()}-tier economy.{" "}
                  {country.leader ? `The current leader is ${country.leader}.` : ""}{" "}
                  {country.capital ? `The capital city is ${country.capital}.` : ""}
                </div>
              </div>

              {/* Create Overview Editor */}
              <div className="border-border/30 flex gap-2 border-t pt-3">
                <Dialog open={showEditor} onOpenChange={setShowEditor}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <RiEditLine className="mr-1 h-3 w-3" />
                      Create Overview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Country Overview - {country.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <p className="text-muted-foreground mb-4 text-sm">
                          Write a comprehensive overview of {country.name}. This will be displayed
                          as the main description on the intelligence briefing.
                        </p>

                        <Textarea
                          value={editorContent}
                          onChange={(e) => setEditorContent(e.target.value)}
                          placeholder={`${country.name} is located in ${country.continent || "the region"}. With a population of ${country.currentPopulation.toLocaleString()} and a ${country.economicTier.toLowerCase()}-tier economy, the nation...`}
                          className="min-h-[300px] font-mono text-sm"
                          style={{
                            fontFamily: 'ui-monospace, "Cascadia Code", "Roboto Mono", monospace',
                          }}
                        />

                        <div className="text-muted-foreground mt-2 text-xs">
                          {editorContent.length} characters • Supports wiki markup ('''bold''',
                          ''italic'', [[links]])
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowEditor(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!editorContent.trim()}>
                          Save Overview
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            // Wiki content exists - show it
            <div className="space-y-4">
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                {(() => {
                  const paragraphs = overviewSection.content.split("||PARAGRAPH_BREAK||");
                  const firstParagraph = paragraphs[0] || "";
                  const remainingParagraphs = paragraphs.slice(1);
                  const hasMoreContent =
                    remainingParagraphs.length > 0 && remainingParagraphs.some((p) => p.trim());

                  return (
                    <>
                      {parseWikiContent(firstParagraph, handleWikiLinkClick)}

                      {showFullOverview && hasMoreContent && (
                        <div className="mt-4 space-y-3">
                          {remainingParagraphs
                            .filter((p) => p.trim())
                            .map((paragraph, index) => (
                              <div key={index}>
                                {parseWikiContent(paragraph, handleWikiLinkClick)}
                              </div>
                            ))}
                        </div>
                      )}

                      {hasMoreContent && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFullOverview(!showFullOverview)}
                            className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                          >
                            {showFullOverview ? (
                              <>
                                <RiArrowUpLine className="mr-1 h-4 w-4" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <RiArrowDownLine className="mr-1 h-4 w-4" />
                                Show More
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Full Article Access */}
              <div className="border-border/30 flex gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      `https://ixwiki.com/wiki/${encodeURIComponent(country.name)}`,
                      "_blank"
                    );
                  }}
                  className="flex-1"
                >
                  <RiExternalLinkLine className="mr-1 h-3 w-3" />
                  View Full Article
                </Button>
              </div>
            </div>
          )}

          {/* Confidence Badge */}
          {wikiData && (
            <div className="border-border/30 flex items-center justify-between border-t pt-3">
              <div className="text-muted-foreground text-xs">
                Last updated: {new Date(wikiData.lastUpdated).toLocaleDateString()}
              </div>
              <Badge variant="outline" className="text-xs">
                Confidence: {wikiData.confidence}%
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
