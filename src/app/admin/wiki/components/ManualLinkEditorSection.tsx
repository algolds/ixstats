"use client";
// src/app/admin/wiki/components/ManualLinkEditorSection.tsx
// Manual wiki article link editor with live test preview.

import { SegmentedControl } from "~/components/ui/segmented-control";
import { useState, useMemo, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
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
import { Card } from "~/components/ui/card";
import type { WikiSource } from "~/lib/wiki-os/config";
import {
  countryRows,
  isWikiOutage,
  unreachableText,
  WIKI_SOURCE_OPTIONS,
  type CountriesData,
} from "./types";

/** What testing a link found: the page (with its intro), no such page, or a wiki that did not answer. */
type TestResult =
  | { status: "found"; intro: string }
  | { status: "missing" }
  | { status: "unreachable"; wiki: WikiSource };

interface IntroRead {
  data?: { intro: string } | null;
  error?: { data?: { code?: string } | null } | null;
}

/** An outage is not "not found": the page may well exist. */
function testResultOf(read: IntroRead, wiki: WikiSource): TestResult {
  if (read.data) return { status: "found", intro: read.data.intro };
  return isWikiOutage(read.error) ? { status: "unreachable", wiki } : { status: "missing" };
}

export function ManualLinkEditorSection({ countriesData }: { countriesData: CountriesData }) {
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<WikiSource>("ixwiki");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const countries = useMemo(() => countryRows(countriesData), [countriesData]);

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
      setTestResult(testResultOf(await wikiIntroQuery.refetch(), wikiSource));
    } catch {
      setTestResult({ status: "missing" });
    } finally {
      setIsTesting(false);
    }
  }, [wikiPageTitle, wikiIntroQuery, wikiSource]);

  const handleSave = useCallback(() => {
    if (!selectedCountryId || !wikiPageTitle.trim()) return;
    setWikiLinkMutation.mutate({ countryId: selectedCountryId, wikiPageTitle, wikiSource });
  }, [selectedCountryId, wikiPageTitle, wikiSource, setWikiLinkMutation]);

  return (
    <Card className="space-y-4 p-5">
      <div className="border-separator flex items-center gap-2 border-b pb-3">
        <Globe className="text-blue h-4 w-4" />
        <h3 className="text-label text-caption">Manual link editor</h3>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-label text-caption">Country</label>
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
              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
            />
            {showDropdown && filteredCountries.length > 0 && !selectedCountry && (
              <FacetListSection
                variant="plain"
                aria-label="Countries"
                className="border-separator bg-surface-elevated text-label rounded-row shadow-floating absolute z-50 mt-1 max-h-48 w-full overflow-y-auto border"
              >
                {filteredCountries.map((c) => (
                  <FacetRow
                    key={c.id}
                    onClick={() => {
                      setSelectedCountryId(c.id);
                      setCountrySearch("");
                      setShowDropdown(false);
                    }}
                    title={c.name}
                    trailing={
                      <span className="text-label-secondary text-footnote font-mono">
                        {c.id.slice(0, 8)}...
                      </span>
                    }
                  />
                ))}
              </FacetListSection>
            )}
          </div>
        </div>

        {/* Wiki Source & Page Title */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-label text-caption">Wiki source</label>
            <SegmentedControl
              size="sm"
              fullWidth
              aria-label="Wiki source"
              value={wikiSource}
              onValueChange={setWikiSource}
              options={WIKI_SOURCE_OPTIONS}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-label text-caption">Wiki page title</label>
            <Input
              placeholder="e.g. United_States or Grand_Duchy_of_..."
              value={wikiPageTitle}
              onChange={(e) => setWikiPageTitle(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestLink}
            disabled={isTesting || !wikiPageTitle.trim()}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
            )}
            Test link
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!selectedCountryId || !wikiPageTitle.trim()}
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            Save link
          </Button>
        </div>

        {testResult && (
          <div
            className={cn(
              "rounded-row text-footnote border p-3",
              testResult.status === "found"
                ? "text-label border-green/30 bg-green/10"
                : "border-red/30 bg-red/10 text-red"
            )}
          >
            {testResult.status === "found" ? (
              <div className="space-y-2">
                <div className="text-green flex items-center gap-2 font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Article found
                </div>
                {testResult.intro && (
                  <p className="text-label-secondary text-footnote line-clamp-3">
                    {testResult.intro}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                {testResult.status === "unreachable"
                  ? `${unreachableText(testResult.wiki)} Try again.`
                  : "Article not found. Check the title and source."}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
