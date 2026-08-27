// src/app/admin/wiki/components/ManualLinkEditorSection.tsx
// Manual wiki article link editor with live test preview.

"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Globe,
  SystemRestart as Loader2,
  CheckCircle,
  XmarkCircle as XCircle,
  OpenNewWindow as ExternalLink,
  FloppyDisk as Save,
} from "iconoir-react";
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
    <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
      <div className="border-border/20 flex items-center gap-2 border-b pb-3">
        <Globe className="h-4 w-4 text-blue-400" />
        <h3 className="text-foreground text-xs font-bold">Manual Link Editor</h3>
      </div>
      <div className="space-y-4">
        {/* Country Selector */}
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-medium">Country</label>
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
              className="border-border/30 bg-background/50 h-8 rounded-xl text-xs backdrop-blur-md"
            />
            {showDropdown && filteredCountries.length > 0 && !selectedCountry && (
              <div className="border-border/40 bg-popover/95 text-popover-foreground absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border p-1 shadow-lg backdrop-blur-md">
                {filteredCountries.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCountryId(c.id);
                      setCountrySearch("");
                      setShowDropdown(false);
                    }}
                    className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium"
                  >
                    <span>{c.name}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {c.id.slice(0, 8)}...
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wiki Source & Page Title */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-medium">Wiki Source</label>
            <div className="bg-card/40 border-border/40 flex rounded-xl border p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setWikiSource("ixwiki")}
                className={cn(
                  "flex-1 rounded-lg py-1 text-xs font-semibold transition-all active:scale-[0.98]",
                  wikiSource === "ixwiki"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                IxWiki
              </button>
              <button
                type="button"
                onClick={() => setWikiSource("iiwiki")}
                className={cn(
                  "flex-1 rounded-lg py-1 text-xs font-semibold transition-all active:scale-[0.98]",
                  wikiSource === "iiwiki"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                IIWiki
              </button>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-foreground text-xs font-medium">Wiki Page Title</label>
            <Input
              placeholder="e.g. United_States or Grand_Duchy_of_..."
              value={wikiPageTitle}
              onChange={(e) => setWikiPageTitle(e.target.value)}
              className="border-border/30 bg-background/50 h-8 rounded-xl font-mono text-xs backdrop-blur-md"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestLink}
            disabled={isTesting || !wikiPageTitle.trim()}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            {isTesting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            )}
            Test Link
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!selectedCountryId || !wikiPageTitle.trim()}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save Link
          </Button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs",
              testResult.success
                ? "text-foreground border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            )}
          >
            {testResult.success ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Article found
                </div>
                {testResult.intro && (
                  <p className="text-muted-foreground line-clamp-3 text-[11px]">
                    {testResult.intro}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                Article not found. Check the title and source.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
