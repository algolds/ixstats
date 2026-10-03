"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, GraphUp as BarChart2, SystemRestart as Loader2, Compass } from "iconoir-react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BaseModalProps } from "./types";
import { TemplateModalShell } from "./TemplateModalShell";

const STAT_FIELDS = [
  { value: "population", label: "Population" },
  { value: "gdp", label: "Total GDP" },
  { value: "gdpPerCapita", label: "GDP per Capita" },
  { value: "gdpGrowth", label: "GDP Growth Rate" },
  { value: "unemployment", label: "Unemployment Rate" },
  { value: "inflation", label: "Inflation Rate" },
  { value: "stability", label: "Political Stability" },
  { value: "tier", label: "Economic Tier" },
  { value: "leader", label: "Leader Name" },
  { value: "government", label: "Government Type" },
  { value: "motto", label: "Motto" },
  { value: "capital", label: "Capital City" },
  { value: "currency", label: "Currency" },
  { value: "currencySymbol", label: "Currency Symbol" },
];

export function CountryStatsModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<{ id: string; name: string } | null>(null);
  const [selectedStat, setSelectedStat] = useState("population");
  const firstInputRef = useRef<HTMLInputElement>(null);

  const { data: userWithRole } = api.users.getCurrentUserWithRole.useQuery();
  const viewerCountryId = userWithRole?.user?.country?.id;

  const { data: countries, isLoading } = api.countries.getSelectList.useQuery(
    { search: searchQuery, limit: 10 },
    { enabled: isOpen }
  );

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line
      setSearchQuery("");
      setSelectedCountry(null);
      setSelectedStat("population");
      // Focus search input on open
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInsertStat = () => {
    if (!selectedCountry) return;
    const isMyCountry = viewerCountryId && selectedCountry.id === viewerCountryId;

    const wikitext = isMyCountry
      ? `{{MyCountry:${selectedStat}}}`
      : `{{CountryData:${selectedCountry.name}:${selectedStat}}}`;

    onInsert(wikitext);
    onClose();
  };

  return (
    <TemplateModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<BarChart2 className="text-yellow size-5 shrink-0" aria-hidden="true" />}
      title="Insert Country Stat"
    >
      {/* Content */}
      <div className="space-y-6 p-6">
        {/* Step 1: Select Country */}
        <div className="space-y-2">
          <label className="text-subhead text-label block">1. Select Country</label>
          <div className="relative">
            <Search className="text-label-secondary absolute top-3 left-3 h-4 w-4" />
            <Input
              ref={firstInputRef}
              type="text"
              placeholder="Search country name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-3 pl-9"
            />
          </div>

          {/* List Results */}
          <div className="border-separator divide-separator bg-fill-4 rounded-control max-h-32 scrollbar-thin divide-y overflow-y-auto border">
            {isLoading && (
              <div className="text-label-secondary text-footnote flex items-center gap-2 p-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading...
              </div>
            )}
            {!isLoading && countries && countries.length > 0 && (
              <FacetListSection variant="plain" aria-label="Countries">
                {countries.map((c) => (
                  <FacetRow
                    key={c.id}
                    onClick={() => setSelectedCountry({ id: c.id, name: c.name })}
                    selected={selectedCountry?.id === c.id}
                    selectionStyle="tint"
                    accessory="check"
                    leading={
                      c.flagUrl ? (
                        <img
                          src={c.flagUrl}
                          alt=""
                          className="border-separator rounded-control-sm h-3 w-5 border object-cover"
                        />
                      ) : undefined
                    }
                    title={c.name}
                    trailing={
                      viewerCountryId && c.id === viewerCountryId ? (
                        <Badge variant="success">My Country</Badge>
                      ) : undefined
                    }
                  />
                ))}
              </FacetListSection>
            )}
            {!isLoading && countries?.length === 0 && (
              <div className="text-label-secondary text-footnote p-3 text-center">
                No countries found.
              </div>
            )}
          </div>
        </div>

        {/* Selected Country Badge */}
        {selectedCountry && (
          <div className="border-separator bg-fill-4 rounded-control flex items-center justify-between border p-3">
            <div>
              <span className="text-label-secondary text-footnote block">Selected Country</span>
              <span className="text-label text-headline">{selectedCountry.name}</span>
            </div>
            <Compass className="text-yellow h-5 w-5" />
          </div>
        )}

        {/* Step 2: Select Stat */}
        <div className="space-y-2">
          <label id="country-stats-attribute" className="text-subhead text-label block">
            2. Choose Stat Attribute
          </label>
          <Select value={selectedStat} onValueChange={setSelectedStat}>
            <SelectTrigger aria-labelledby="country-stats-attribute" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAT_FIELDS.map((stat) => (
                <SelectItem key={stat.value} value={stat.value}>
                  {stat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview syntax */}
        {selectedCountry && (
          <div className="rounded-control bg-surface-secondary text-footnote text-label-secondary p-3 text-center font-mono">
            Syntax:{" "}
            {viewerCountryId && selectedCountry.id === viewerCountryId
              ? `{{MyCountry:${selectedStat}}}`
              : `{{CountryData:${selectedCountry.name}:${selectedStat}}}`}
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-separator flex items-center justify-end gap-3 border-t pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsertStat} disabled={!selectedCountry}>
            Insert Stat
          </Button>
        </div>
      </div>
    </TemplateModalShell>
  );
}
