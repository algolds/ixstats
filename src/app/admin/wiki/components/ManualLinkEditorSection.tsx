// src/app/admin/wiki/components/ManualLinkEditorSection.tsx
// Manual wiki article link editor with live test preview.

"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Globe, SystemRestart as Loader2, CheckCircle, XmarkCircle as XCircle, OpenNewWindow as ExternalLink, FloppyDisk as Save } from "iconoir-react";
import { cn } from "~/lib/utils";

export function ManualLinkEditorSection({ countriesData }: { countriesData: any }) {
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const [testResult, setTestResult] = useState<{ success: boolean; intro?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const countries = useMemo(() => {
    const list = countriesData?.countries ?? countriesData ?? [];
    if (!Array.isArray(list)) return [];
    return list as Array<{ id: string; name: string }>;
  }, [countriesData]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries.slice(0, 20);
    const q = countrySearch.toLowerCase();
    return countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
  }, [countries, countrySearch]);

  const selectedCountry = countries.find((c) => c.id === selectedCountryId);

  const wikiIntroQuery = api.wikios.getIntro.useQuery(
    { title: wikiPageTitle, wiki: wikiSource },
    { enabled: false }
  );
  const notify = useNotify();
  const utils = api.useUtils();
  const setWikiLinkMutation = api.admin.setWikiLink.useMutation({
    onSuccess: () => {
      notify.success("Saved", "Wiki link saved");
      utils.countries.getAll.invalidate();
    },
    onError: () => notify.error("Error", "Failed to save wiki link"),
  });

  const handleTestLink = useCallback(async () => {
    if (!wikiPageTitle.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = (await wikiIntroQuery.refetch()) as any;
      if (result.data) {
        setTestResult({
          success: true,
          intro:
            typeof result.data === "string" ? result.data : (result.data.text ?? "Article found"),
        });
      } else {
        setTestResult({ success: false });
      }
    } catch {
      setTestResult({ success: false });
    } finally {
      setIsTesting(false);
    }
  }, [wikiPageTitle, wikiIntroQuery]);

  const handleSave = useCallback(() => {
    if (!selectedCountryId || !wikiPageTitle.trim()) return;
    setWikiLinkMutation.mutate({ countryId: selectedCountryId, wikiPageTitle, wikiSource });
  }, [selectedCountryId, wikiPageTitle, wikiSource, setWikiLinkMutation]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-blue-500" />
          Manual Link Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country Selector */}
        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-medium">Country</label>
          <div className="relative">
            <Input
              placeholder="Search for a country..."
              value={selectedCountry ? selectedCountry.name : countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setSelectedCountryId(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {showDropdown && filteredCountries.length > 0 && !selectedCountryId && (
              <div className="border-border/50 bg-popover absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-lg">
                {filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="text-foreground hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedCountryId(c.id);
                      setCountrySearch(c.name);
                      setShowDropdown(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wiki Page Title */}
        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-medium">Wiki Page Title</label>
          <Input
            placeholder="e.g., Urcea, Burgundie, Caphiria..."
            value={wikiPageTitle}
            onChange={(e) => {
              setWikiPageTitle(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        {/* Wiki Source */}
        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-medium">Wiki Source</label>
          <div className="flex gap-2">
            {(["ixwiki", "iiwiki"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => {
                  setWikiSource(source);
                  setTestResult(null);
                }}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm font-medium transition-all",
                  wikiSource === source
                    ? "text-foreground border-blue-500/50 bg-blue-500/10"
                    : "border-border/50 text-muted-foreground hover:bg-muted/30"
                )}
              >
                {source === "ixwiki" ? "IxWiki" : "IIWiki"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleTestLink}
            disabled={!wikiPageTitle.trim() || isTesting}
            className="gap-2"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Test Link
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedCountryId || !wikiPageTitle.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Link
          </Button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              testResult.success
                ? "text-foreground border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5 text-red-400"
            )}
          >
            {testResult.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-emerald-500">
                  <CheckCircle className="h-4 w-4" />
                  Article found
                </div>
                {testResult.intro && (
                  <p className="text-muted-foreground line-clamp-4 text-xs">{testResult.intro}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Article not found. Check the title and source.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
