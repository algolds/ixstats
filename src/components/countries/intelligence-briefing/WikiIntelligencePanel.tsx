/**
 * Wiki Intelligence Panel Component
 *
 * Displays wiki-sourced intelligence data including overview text,
 * coat of arms, and full article access.
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { parseWikiContent, handleWikiLinkClick } from "~/lib/wiki-markup-parser";
import type { WikiIntelligenceData } from "~/types/intelligence-briefing";
import { RiExternalLinkLine, RiEditLine, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";

interface WikiIntelligencePanelProps {
  wikiData?: WikiIntelligenceData;
  countryName: string;
  onSaveOverview?: (content: string) => void;
}

export const WikiIntelligencePanel = React.memo<WikiIntelligencePanelProps>(
  ({ wikiData, countryName, onSaveOverview }) => {
    const [showFullOverview, setShowFullOverview] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editorContent, setEditorContent] = useState("");

    const overviewSection = wikiData?.sections?.find((section) => section.id === "overview");

    // Fallback content when no wiki data
    const renderFallbackContent = () => {
      const fallbackText = `${countryName} is a sovereign nation. Additional intelligence data is being compiled.`;

      return (
        <div className="space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
            <div className="text-muted-foreground">{fallbackText}</div>
          </div>

          {onSaveOverview && (
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
                    <DialogTitle>Create Country Overview - {countryName}</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <p className="text-muted-foreground mb-4 text-sm">
                        Write a comprehensive overview of {countryName}. This will be displayed as
                        the main description on the intelligence briefing.
                      </p>

                      <Textarea
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        placeholder={`${countryName} is located in the region. With a population and economy, the nation...`}
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
                      <Button
                        onClick={() => {
                          if (editorContent.trim() && onSaveOverview) {
                            onSaveOverview(editorContent.trim());
                            setShowEditor(false);
                            setEditorContent("");
                          }
                        }}
                        disabled={!editorContent.trim()}
                      >
                        Save Overview
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      );
    };

    // Render wiki content
    const renderWikiContent = () => {
      if (!overviewSection) return renderFallbackContent();

      const paragraphs = overviewSection.content.split("||PARAGRAPH_BREAK||");
      const firstParagraph = paragraphs[0] || "";
      const remainingParagraphs = paragraphs.slice(1);
      const hasMoreContent =
        remainingParagraphs.length > 0 && remainingParagraphs.some((p) => p.trim());

      return (
        <div className="space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
            {parseWikiContent(firstParagraph, handleWikiLinkClick)}

            {showFullOverview && hasMoreContent && (
              <div className="mt-4 space-y-3">
                {remainingParagraphs
                  .filter((p) => p.trim())
                  .map((paragraph, index) => (
                    <div key={index}>{parseWikiContent(paragraph, handleWikiLinkClick)}</div>
                  ))}
              </div>
            )}
          </div>

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

          {/* Full Article Access */}
          <div className="border-border/30 flex gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`https://ixwiki.com/wiki/${encodeURIComponent(countryName)}`, "_blank");
              }}
              className="flex-1"
            >
              <RiExternalLinkLine className="mr-1 h-3 w-3" />
              View Full Article
            </Button>
          </div>
        </div>
      );
    };

    return (
      <Card className="glass-hierarchy-child relative overflow-hidden">
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
              <UnifiedCountryFlag countryName={countryName} size="xl" />
            </div>
          )}
          <div className="from-background/75 via-background/50 to-background/75 absolute inset-0 bg-gradient-to-r"></div>
        </div>

        <CardHeader />
        <CardContent>
          <div className="relative space-y-6">
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
                      <DialogTitle>Coat of Arms - {countryName}</DialogTitle>
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
                      Official coat of arms of {countryName}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Overview Text */}
            {renderWikiContent()}
          </div>
        </CardContent>
      </Card>
    );
  }
);

WikiIntelligencePanel.displayName = "WikiIntelligencePanel";
