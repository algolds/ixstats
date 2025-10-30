/**
 * WikiSettingsView Component
 *
 * Configuration interface for wiki intelligence settings. Provides controls for:
 * - Enabling/disabling wiki sources (IxWiki, IIWiki, Custom URL)
 * - Configuring page discovery strategies
 * - Managing custom wiki pages
 * - Applying settings and refreshing intelligence data
 *
 * Extracted from WikiIntelligenceTab for modularity and maintainability.
 */

import React from 'react';
import { RiSettings3Line, RiRefreshLine } from 'react-icons/ri';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import { type WikiSettings } from '~/types/wiki-intelligence';
import { WikiPageSearch } from '~/components/countries/WikiPageSearch';

/**
 * Props for the WikiSettingsView component
 */
interface WikiSettingsViewProps {
  /** Current wiki settings configuration */
  wikiSettings: WikiSettings;

  /** Callback to update wiki settings */
  setWikiSettings: (settings: WikiSettings | ((prev: WikiSettings) => WikiSettings)) => void;

  /** Name of the country for context in page search */
  countryName: string;

  /** Async handler to apply settings and refresh data */
  onApplySettings: () => Promise<void>;

  /** Whether settings are currently being applied */
  isApplying: boolean;
}

/**
 * WikiSettingsView Component
 *
 * Renders the intelligence configuration interface with wiki source toggles,
 * page discovery strategy options, custom page management, and action buttons.
 *
 * @example
 * ```tsx
 * <WikiSettingsView
 *   wikiSettings={wikiSettings}
 *   setWikiSettings={setWikiSettings}
 *   countryName="Burgundie"
 *   onApplySettings={handleApplySettings}
 *   isApplying={isRefreshing}
 * />
 * ```
 */
export function WikiSettingsView({
  wikiSettings,
  setWikiSettings,
  countryName,
  onApplySettings,
  isApplying,
}: WikiSettingsViewProps) {
  /**
   * Resets wiki settings to default values
   */
  const handleResetToDefaults = () => {
    setWikiSettings({
      enableIxWiki: true,
      enableIIWiki: false,
      enableMediaWiki: true,
      autoDiscovery: true,
      maxSections: 10,
      customPages: [],
      wikiBaseUrls: {
        ixwiki: 'https://ixwiki.com',
        iiwiki: 'https://iiwiki.com',
        custom: '',
      },
      contentFilters: {
        removeTemplates: true,
        preserveLinks: true,
        removeCategories: true,
        removeInfoboxes: false,
        aggressiveCleaning: true,
      },
      pageVariants: {
        useCountryVariants: true,
        useTopicPages: true,
        useCustomSearch: false,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiSettings3Line className="h-5 w-5 text-blue-400" />
            Intelligence Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wiki Sources */}
          <div>
            <h4 className="font-medium mb-3">Sources</h4>
            <div className="space-y-3">
              {/* IxWiki Source */}
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={wikiSettings.enableIxWiki}
                    onChange={(e) =>
                      setWikiSettings((prev) => ({
                        ...prev,
                        enableIxWiki: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-medium">IxWiki</div>
                    <div className="text-sm text-muted-foreground">
                      ixwiki.com - The bespoke two-decades old geopolitical
                      worldbuilding community & fictional encyclopedia
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-green-400 border-green-400/30"
                >
                  Active
                </Badge>
              </div>

              {/* IIWiki Source */}
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={wikiSettings.enableIIWiki}
                    onChange={(e) =>
                      setWikiSettings((prev) => ({
                        ...prev,
                        enableIIWiki: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <div className="font-medium">IIWiki</div>
                    <div className="text-sm text-muted-foreground">
                      iiwiki.com - SimFic and Alt-History Encyclopedia
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-blue-400 border-blue-400/30"
                >
                  Optional
                </Badge>
              </div>

              {/* Custom Wiki URL */}
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="font-medium mb-2">Custom Wiki URL</div>
                <input
                  type="url"
                  placeholder="https://custom-wiki.com"
                  value={wikiSettings.wikiBaseUrls.custom}
                  onChange={(e) =>
                    setWikiSettings((prev) => ({
                      ...prev,
                      wikiBaseUrls: {
                        ...prev.wikiBaseUrls,
                        custom: e.target.value,
                      },
                    }))
                  }
                  className="w-full p-2 bg-background/50 rounded border border-border text-sm"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Use a custom wiki for additional content sources
                </div>
              </div>
            </div>
          </div>

          {/* Page Discovery Strategy */}
          <div>
            <h4 className="font-medium mb-3">Page Discovery Strategy</h4>
            <div className="space-y-3">
              {/* Country Name Variants */}
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={wikiSettings.pageVariants.useCountryVariants}
                    onChange={(e) =>
                      setWikiSettings((prev) => ({
                        ...prev,
                        pageVariants: {
                          ...prev.pageVariants,
                          useCountryVariants: e.target.checked,
                        },
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="font-medium">Country Name Variants</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Search: &quot;{countryName}&quot;, &quot;{countryName}{' '}
                  (country)&quot;, &quot;{countryName} (nation)&quot;
                </div>
              </div>

              {/* Topic-Specific Pages */}
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={wikiSettings.pageVariants.useTopicPages}
                    onChange={(e) =>
                      setWikiSettings((prev) => ({
                        ...prev,
                        pageVariants: {
                          ...prev.pageVariants,
                          useTopicPages: e.target.checked,
                        },
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="font-medium">Topic-Specific Pages</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Search: &quot;Economy of X&quot;, &quot;Politics of X&quot;,
                  &quot;History of X&quot;, etc.
                </div>
              </div>
            </div>
          </div>

          {/* Custom Pages */}
          <div>
            <h4 className="font-medium mb-3">Custom Wiki Pages</h4>
            <div className="p-3 bg-muted/20 rounded-lg">
              <div className="text-sm text-muted-foreground mb-3">
                Search for specific wiki pages or enter custom page names. These
                will be processed in addition to automatic discovery.
              </div>
              <WikiPageSearch
                selectedPages={wikiSettings.customPages}
                onPagesChange={(pages: string[]) =>
                  setWikiSettings((prev) => ({ ...prev, customPages: pages }))
                }
                countryName={countryName}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border/50">
            <Button
              onClick={onApplySettings}
              className="flex-1"
              disabled={isApplying}
            >
              <RiRefreshLine
                className={cn('h-4 w-4 mr-2', isApplying && 'animate-spin')}
              />
              Apply Settings & Refresh
            </Button>
            <Button variant="outline" onClick={handleResetToDefaults}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WikiSettingsView;
