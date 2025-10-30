/**
 * WikiInfoBoxSidebar Component
 *
 * Displays wiki infobox data in a sidebar format with national symbols,
 * key information fields, and raw data expansion for advanced users.
 *
 * @component
 * @example
 * ```tsx
 * <WikiInfoBoxSidebar
 *   infobox={wikiData.infobox}
 *   handleWikiLinkClick={(page) => navigate(page)}
 *   onRefresh={() => refetchWikiData()}
 *   flagColors={{ primary: '#gold', secondary: '#blue', accent: '#red' }}
 *   viewerClearanceLevel="RESTRICTED"
 * />
 * ```
 */

import React from "react";
import { RiGlobalLine, RiShieldLine, RiBookOpenLine, RiRefreshLine } from "react-icons/ri";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { type CountryInfobox } from "~/lib/mediawiki-service";
import { parseInfoboxValue } from "~/lib/wiki-intelligence-parser";

/**
 * Props for WikiInfoBoxSidebar component
 */
interface WikiInfoBoxSidebarProps {
  /** Infobox data from MediaWiki API */
  infobox: CountryInfobox | null;
  /** Handler for wiki link clicks */
  handleWikiLinkClick: (page: string) => void;
  /** Callback for refresh action */
  onRefresh: () => void;
  /** Flag colors for theming */
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Viewer's clearance level for data access */
  viewerClearanceLevel: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
}

/**
 * WikiInfoBoxSidebar displays wiki infobox data in a compact sidebar format
 * with national symbols, key information, and expandable raw data.
 *
 * Features:
 * - National symbols section (flag + coat of arms) with clickable images
 * - Key info fields (capital, government, leader, languages, currency, demonym)
 * - Raw data expansion for non-PUBLIC clearance levels
 * - Empty state with retry button
 *
 * @param props - Component props
 * @returns Sidebar component with wiki infobox data
 */
export const WikiInfoBoxSidebar: React.FC<WikiInfoBoxSidebarProps> = ({
  infobox,
  handleWikiLinkClick,
  onRefresh,
  flagColors,
  viewerClearanceLevel,
}) => {
  // Key fields to display in sidebar
  const keyFields = [
    { key: "capital", label: "Capital" },
    { key: "government_type", label: "Government" },
    { key: "leader_name1", label: "Head of State" },
    { key: "official_languages", label: "Languages" },
    { key: "currency", label: "Currency" },
    { key: "demonym", label: "Demonym" },
  ];

  /**
   * Renders the national symbols section (flag and coat of arms)
   */
  const renderNationalSymbols = () => {
    const hasFlag = infobox?.image_flag || infobox?.flag;
    const hasCoat = infobox?.image_coat || infobox?.coat_of_arms;

    if (!hasFlag && !hasCoat) return null;

    return (
      <div className="rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 p-3">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <RiShieldLine className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          National Symbols
        </h4>
        <div className="flex items-center justify-center gap-4">
          {hasFlag && (
            <div
              className="group cursor-pointer"
              onClick={() => {
                const flagFile = infobox?.image_flag || infobox?.flag;
                if (flagFile) window.open(`https://ixwiki.com/wiki/File:${flagFile}`, "_blank");
              }}
            >
              <div className="text-center">
                <div className="relative mb-1 rounded-lg border border-blue-400/30 bg-blue-500/10 p-2 transition-all duration-300 group-hover:border-blue-400/50">
                  <img
                    src={`https://ixwiki.com/wiki/Special:Filepath/${infobox?.image_flag || infobox?.flag}`}
                    alt="National Flag"
                    className="h-7 w-12 rounded object-cover shadow-lg transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                </div>
                <div className="text-xs font-medium text-blue-400">Flag</div>
              </div>
            </div>
          )}

          {hasCoat && (
            <div
              className="group cursor-pointer"
              onClick={() => {
                const coatFile = infobox?.image_coat || infobox?.coat_of_arms;
                if (coatFile) window.open(`https://ixwiki.com/wiki/File:${coatFile}`, "_blank");
              }}
            >
              <div className="text-center">
                <div className="relative mb-1 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 transition-all duration-300 group-hover:border-amber-400/50">
                  <img
                    src={`https://ixwiki.com/wiki/Special:Filepath/${infobox?.image_coat || infobox?.coat_of_arms}`}
                    alt="Coat of Arms"
                    className="h-7 w-7 rounded object-cover shadow-lg transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-amber-400"></div>
                </div>
                <div className="text-xs font-medium text-amber-400">Coat of Arms</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Renders key information fields
   */
  const renderKeyFields = () => {
    const fieldsToDisplay = keyFields.filter(
      (field) => infobox?.[field.key as keyof CountryInfobox]
    );

    if (fieldsToDisplay.length === 0) return null;

    return (
      <div className="space-y-3">
        {fieldsToDisplay.map((field) => (
          <div key={field.key} className="bg-muted/20 rounded-lg p-2">
            <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {field.label}
            </div>
            <div className="text-foreground text-xs leading-relaxed">
              {parseInfoboxValue(infobox?.[field.key as keyof CountryInfobox] as string)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders raw data expansion for advanced users
   */
  const renderRawData = () => {
    if (viewerClearanceLevel === "PUBLIC" || !infobox) return null;

    return (
      <div className="border-border/50 border-t pt-3">
        <details className="group">
          <summary className="text-muted-foreground group-open:text-foreground cursor-pointer text-xs font-medium">
            Raw Data ({Object.keys(infobox).length} fields)
          </summary>
          <div className="bg-muted/30 mt-2 max-h-32 overflow-auto rounded p-2 font-mono text-xs">
            <pre className="text-xs">{JSON.stringify(infobox, null, 1)}</pre>
          </div>
        </details>
      </div>
    );
  };

  /**
   * Renders empty state when no infobox data is available
   */
  const renderEmptyState = () => (
    <Card className="glass-hierarchy-child">
      <CardContent className="p-4 text-center">
        <RiBookOpenLine className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <h3 className="mb-1 text-sm font-semibold">No Infobox Data</h3>
        <p className="text-muted-foreground mb-3 text-xs">Wiki infobox could not be retrieved.</p>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RiRefreshLine className="mr-1 h-3 w-3" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="sticky top-6">
      {infobox ? (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.primary }} />
              Wiki Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderNationalSymbols()}
            {renderKeyFields()}
            {renderRawData()}
          </CardContent>
        </Card>
      ) : (
        renderEmptyState()
      )}
    </div>
  );
};
