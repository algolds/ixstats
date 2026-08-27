"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Xmark as X,
  Search,
  GraphUp as BarChart2,
  SystemRestart as Loader2,
  Compass,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Portal, type BaseModalProps } from "./types";

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

  // Close on Escape keypress
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="border-border bg-card/95 text-foreground dark:bg-card/95 relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl dark:border-white/15"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-b px-6 py-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
              <BarChart2 className="h-5 w-5 text-amber-400" />
              Insert Country Stat
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors active:scale-95 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 p-6">
            {/* Step 1: Select Country */}
            <div className="space-y-2">
              <label className="text-foreground block text-xs font-semibold">
                1. Select Country
              </label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="Search country name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
                />
              </div>

              {/* List Results */}
              <div className="border-border divide-border bg-muted/20 max-h-32 scrollbar-thin divide-y overflow-y-auto rounded-lg border">
                {isLoading && (
                  <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </div>
                )}
                {!isLoading &&
                  countries?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCountry({ id: c.id, name: c.name })}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        selectedCountry?.id === c.id
                          ? "bg-amber-500/20 font-semibold text-amber-400"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {c.flagUrl && (
                          <img
                            src={c.flagUrl}
                            alt=""
                            className="border-border h-3 w-5 rounded-sm border object-cover"
                          />
                        )}
                        {c.name}
                      </span>
                      {viewerCountryId && c.id === viewerCountryId && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                          My Country
                        </span>
                      )}
                    </button>
                  ))}
                {!isLoading && countries?.length === 0 && (
                  <div className="text-muted-foreground p-3 text-center text-xs">
                    No countries found.
                  </div>
                )}
              </div>
            </div>

            {/* Selected Country Badge */}
            {selectedCountry && (
              <div className="border-border bg-muted/20 flex items-center justify-between rounded-lg border p-3">
                <div>
                  <span className="text-muted-foreground block text-xs">Selected Country</span>
                  <span className="text-foreground text-sm font-bold">{selectedCountry.name}</span>
                </div>
                <Compass className="h-5 w-5 text-amber-400" />
              </div>
            )}

            {/* Step 2: Select Stat */}
            <div className="space-y-2">
              <label className="text-foreground block text-xs font-semibold">
                2. Choose Stat Attribute
              </label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value)}
                className="border-input bg-secondary text-foreground focus:ring-ring w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                {STAT_FIELDS.map((stat) => (
                  <option
                    key={stat.value}
                    value={stat.value}
                    className="bg-popover text-foreground"
                  >
                    {stat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview syntax */}
            {selectedCountry && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center font-mono text-xs text-emerald-400">
                Syntax:{" "}
                {viewerCountryId && selectedCountry.id === viewerCountryId
                  ? `{{MyCountry:${selectedStat}}}`
                  : `{{CountryData:${selectedCountry.name}:${selectedStat}}}`}
              </div>
            )}

            {/* Footer Actions */}
            <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
              <button
                onClick={onClose}
                className="text-foreground hover:bg-muted rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertStat}
                disabled={!selectedCountry}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-sm transition-all hover:bg-amber-400 active:scale-[0.97] disabled:opacity-50"
              >
                Insert Stat
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
