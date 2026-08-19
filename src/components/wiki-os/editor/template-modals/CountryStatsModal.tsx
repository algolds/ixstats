"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, BarChart2, Loader2, Compass } from "lucide-react";
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
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="glass-surface glass-refraction-none relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1524]/90 text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <BarChart2 className="h-5 w-5 text-amber-400" />
              Insert Country Stat
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6 p-6">
            {/* Step 1: Select Country */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/75">1. Select Country</label>
              <div className="relative">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-white/40" />
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="Search country name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* List Results */}
              <div className="max-h-32 scrollbar-thin divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                {isLoading && (
                  <div className="flex items-center gap-2 p-3 text-xs text-white/50">
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
                          : "text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {c.flagUrl && (
                          <img
                            src={c.flagUrl}
                            alt=""
                            className="h-3 w-5 rounded-sm border border-white/10 object-cover"
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
                  <div className="p-3 text-center text-xs text-white/40">No countries found.</div>
                )}
              </div>
            </div>

            {/* Selected Country Badge */}
            {selectedCountry && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                <div>
                  <span className="block text-xs text-white/40">Selected Country</span>
                  <span className="text-sm font-bold text-white">{selectedCountry.name}</span>
                </div>
                <Compass className="h-5 w-5 text-amber-400" />
              </div>
            )}

            {/* Step 2: Select Stat */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/75">
                2. Choose Stat Attribute
              </label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 bg-[right_12px_center] bg-no-repeat px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {STAT_FIELDS.map((stat) => (
                  <option key={stat.value} value={stat.value} className="bg-[#121c2c] text-white">
                    {stat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview syntax */}
            {selectedCountry && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 text-center font-mono text-xs text-emerald-400">
                Syntax:{" "}
                {viewerCountryId && selectedCountry.id === viewerCountryId
                  ? `{{MyCountry:${selectedStat}}}`
                  : `{{CountryData:${selectedCountry.name}:${selectedStat}}}`}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertStat}
                disabled={!selectedCountry}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
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
