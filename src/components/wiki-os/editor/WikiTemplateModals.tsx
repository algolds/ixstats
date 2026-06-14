// src/components/wiki-os/editor/WikiTemplateModals.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  // eslint-disable-next-line unused-imports/no-unused-imports
  MapPin,
  Building,
  BarChart2,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Globe,
  Flag,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Plus,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Compass,
  Map as MapIcon,
  // eslint-disable-next-line unused-imports/no-unused-imports
  HelpCircle,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ArrowRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/map-config";
// eslint-disable-next-line unused-imports/no-unused-imports
import { booleanPointInPolygon, point } from "@turf/turf";

// Helper Portal component to render modals under document.body
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

// Types for all Modals
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}

// ---------------------------------------------------------------------------
// 1. INFOBOX COUNTRY MODAL
// ---------------------------------------------------------------------------
export function InfoboxCountryModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    nativeName: "",
    capital: "",
    motto: "",
    currency: "",
    currencySymbol: "",
    government: "",
    leader: "",
    flagImage: "",
    mapImage: "",
  });
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        nativeName: "",
        capital: "",
        motto: "",
        currency: "",
        currencySymbol: "",
        government: "",
        leader: "",
        flagImage: "",
        mapImage: "",
      });
      // Focus first input on open
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const infoboxText = `{{Infobox Country
|name = ${formData.name || "{{PAGENAME}}"}
|native_name = ${formData.nativeName}
|capital = ${formData.capital}
|motto = ${formData.motto}
|currency = ${formData.currency}
|currency_symbol = ${formData.currencySymbol}
|government = ${formData.government}
|leader = ${formData.leader}
|flag_image = ${formData.flagImage}
|map_image = ${formData.mapImage}
}}`;
    onInsert(infoboxText);
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="glass-surface glass-refraction-none relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1524]/90 text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Flag className="h-5 w-5 text-blue-400" />
              Insert Infobox Country
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Country Name
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Moscakee"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Native Name
                </label>
                <input
                  type="text"
                  value={formData.nativeName}
                  onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                  placeholder="e.g. Mosckea"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Capital City
                </label>
                <input
                  type="text"
                  value={formData.capital}
                  onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                  placeholder="e.g. Ostrava"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Motto</label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="e.g. Freedom and Unity"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Currency Name
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="e.g. Crown"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="e.g. 👑"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Government Type
                </label>
                <input
                  type="text"
                  value={formData.government}
                  onChange={(e) => setFormData({ ...formData, government: e.target.value })}
                  placeholder="e.g. Constitutional Monarchy"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Leader / Ruler
                </label>
                <input
                  type="text"
                  value={formData.leader}
                  onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
                  placeholder="e.g. King Michael"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Flag Image filename
                </label>
                <input
                  type="text"
                  value={formData.flagImage}
                  onChange={(e) => setFormData({ ...formData, flagImage: e.target.value })}
                  placeholder="e.g. Flag_of_Moscakee.png"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Map Image filename
                </label>
                <input
                  type="text"
                  value={formData.mapImage}
                  onChange={(e) => setFormData({ ...formData, mapImage: e.target.value })}
                  placeholder="e.g. Map_of_Moscakee.png"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Insert Template
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// 2. COUNTRY STATS MODAL
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 3. BUSINESS STATS MODAL
// ---------------------------------------------------------------------------
const BUSINESS_FIELDS = [
  { value: "revenue", label: "Annual Revenue" },
  { value: "employees", label: "Employees Count" },
  { value: "sector", label: "Industry Sector" },
  { value: "founded", label: "Year Founded" },
];

type BusinessModalTab = "search" | "create";

export function BusinessStatsModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [activeTab, setActiveTab] = useState<BusinessModalTab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<{ name: string } | null>(null);
  const [selectedField, setSelectedField] = useState("revenue");

  // Create form states
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("commercial");
  const [newDesc, setNewDesc] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");

  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const { data: userWithRole } = api.users.getCurrentUserWithRole.useQuery();
  const viewerCountryId = userWithRole?.user?.country?.id;

  const { data: businesses, isLoading: searchLoading } = api.wiki.searchBusinesses.useQuery(
    { query: searchQuery, countryId: viewerCountryId },
    { enabled: isOpen }
  );

  const createPoiMutation = api.geoFeatures.createPOI.useMutation();

  useEffect(() => {
    if (isOpen) {
      setActiveTab("search");
      setSearchQuery("");
      setSelectedBusiness(null);
      setSelectedField("revenue");
      setNewName("");
      setNewCategory("commercial");
      setNewDesc("");
      setNewLat("");
      setNewLng("");
      setCreateError(null);
      setCreateSuccess(false);

      // Focus search input on open
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "create") {
      setTimeout(() => {
        createInputRef.current?.focus();
      }, 50);
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [activeTab, isOpen]);

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

  const handleInsertBusiness = () => {
    if (!selectedBusiness) return;
    onInsert(`{{BusinessData:${selectedBusiness.name}:${selectedField}}}`);
    onClose();
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(false);

    if (!viewerCountryId) {
      setCreateError("You must own or belong to a country to register business features.");
      return;
    }

    const latVal = parseFloat(newLat);
    const lngVal = parseFloat(newLng);

    if (isNaN(latVal) || isNaN(lngVal)) {
      setCreateError("Valid numeric coordinates [lat, lng] are required.");
      return;
    }

    try {
      await createPoiMutation.mutateAsync({
        countryId: viewerCountryId,
        name: newName,
        category: newCategory,
        coordinates: [lngVal, latVal], // geoFeatures.createPOI expects [lng, lat]
        description: newDesc || undefined,
      });

      setCreateSuccess(true);
      setSelectedBusiness({ name: newName });
      setActiveTab("search");
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to register new business POI.");
    }
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
              <Building className="h-5 w-5 text-cyan-400" />
              Insert Business Data
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                activeTab === "search"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Search Approved Businesses
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                activeTab === "create"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              + Register &amp; Link Business
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "search" ? (
            <div className="space-y-4 p-6">
              {/* Search */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/75">Find Company</label>
                <div className="relative">
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-white/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search registered business..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* List */}
                <div className="max-h-36 scrollbar-thin divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                  {searchLoading && (
                    <div className="flex items-center gap-2 p-3 text-xs text-white/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                      Searching...
                    </div>
                  )}
                  {!searchLoading &&
                    businesses?.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBusiness({ name: b.name })}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          selectedBusiness?.name === b.name
                            ? "bg-cyan-500/20 font-semibold text-cyan-400"
                            : "text-white/80 hover:bg-white/5"
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] capitalize opacity-60">
                          {b.category}
                        </span>
                      </button>
                    ))}
                  {!searchLoading && businesses?.length === 0 && (
                    <div className="p-3 text-center text-xs text-white/40">
                      No matching businesses found.
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Business */}
              {selectedBusiness && (
                <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3">
                  <div>
                    <span className="block text-xs font-semibold text-cyan-400/60">
                      Ready to Link
                    </span>
                    <span className="text-sm font-bold text-white">{selectedBusiness.name}</span>
                  </div>
                  {createSuccess && (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Registered
                    </span>
                  )}
                </div>
              )}

              {/* Field selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/75">
                  Select Attribute Field
                </label>
                <select
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-[#121c2c] bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {BUSINESS_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBusiness && (
                <div className="rounded border border-cyan-950 bg-[#0e223a]/40 p-2.5 text-center font-mono text-xs text-cyan-400">
                  Syntax: {`{{BusinessData:${selectedBusiness.name}:${selectedField}}}`}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertBusiness}
                  disabled={!selectedBusiness}
                  className="animate-pulse-subtle rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
                >
                  Insert Business Data
                </button>
              </div>
            </div>
          ) : (
            /* Create and Link business POI */
            <form
              onSubmit={handleCreateBusiness}
              className="max-h-[60vh] scrollbar-thin space-y-4 overflow-y-auto p-6"
            >
              {!viewerCountryId ? (
                <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
                  <h4 className="text-sm font-bold text-red-200">Registration Locked</h4>
                  <p className="text-xs text-white/60">
                    Only country owners can construct new business points of interest in the
                    database. You can type a business name in the search tab to reference it
                    manually if it exists.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">
                      Business/Company Name
                    </label>
                    <input
                      ref={createInputRef}
                      type="text"
                      required
                      placeholder="e.g. Caphira Logistics"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">
                      POI Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-white/10 bg-[#121c2c] bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option value="commercial">Commercial Shop / Retail</option>
                      <option value="office">Corporate Office / Finance</option>
                      <option value="industrial">Industrial Facility</option>
                      <option value="factory">Factory / Manufacturing</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-white/75">
                        Latitude (Y)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12.3456"
                        value={newLat}
                        onChange={(e) => setNewLat(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-white/75">
                        Longitude (X)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 45.6789"
                        value={newLng}
                        onChange={(e) => setNewLng(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">
                      Short Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Short summary of this corporate establishment..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  {createError && (
                    <div className="flex items-center gap-1.5 rounded border border-red-500/25 bg-red-500/10 p-2 text-xs text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab("search")}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPoiMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {createPoiMutation.isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Create &amp; Link
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ---------------------------------------------------------------------------
// 4. MAP COORDINATES MODAL
// ---------------------------------------------------------------------------
type MapCoordsTab = "coords" | "mapembed";

export function MapCoordsModal({ isOpen, onClose, onInsert }: BaseModalProps) {
  const [activeTab, setActiveTab] = useState<MapCoordsTab>("coords");
  const [lat, setLat] = useState("0");
  const [lng, setLng] = useState("0");
  const [zoom, setZoom] = useState(5);
  const [label, setLabel] = useState("");

  // MapEmbed specific states
  const [embedHeight, setEmbedHeight] = useState(400);
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedInteractive, setEmbedInteractive] = useState(true);

  // Map rendering refs/state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [mapLoaded, setMapLoaded] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const { data: userWithRole } = api.users.getCurrentUserWithRole.useQuery();
  const viewerCountryId = userWithRole?.user?.country?.id;

  const {
    geometry,
    centroid,
    bbox,
    fillColor,
    featureId,
    subdivisions,
    worldPolitical,
    cities,
    pois,
    isLoading: isMapBundleLoading,
  } = useCountryMapEmbed(viewerCountryId);

  // Reset inputs when opening
  useEffect(() => {
    if (isOpen) {
      setLat("0");
      setLng("0");
      setZoom(5);
      setLabel("");
      setEmbedHeight(400);
      setEmbedWidth("100%");
      setEmbedInteractive(true);
      setMapLoaded(false);

      // Focus label input
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Center on country centroid if available
  useEffect(() => {
    if (isOpen && centroid) {
      setLat(centroid.lat.toFixed(5));
      setLng(centroid.lng.toFixed(5));
    }
  }, [isOpen, centroid]);

  // Close on Escape keypress
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle marker selection from quick list
  const handleMarkerSelect = (markerLat: number, markerLng: number, markerName: string) => {
    setLat(markerLat.toFixed(5));
    setLng(markerLng.toFixed(5));
    setLabel(markerName);

    // Update map coordinates
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [markerLng, markerLat], zoom: 8 });

      // Move marker
      if (markerRef.current) {
        markerRef.current.setLngLat([markerLng, markerLat]);
      }
    }
  };

  // Initialize MapLibre
  const initMapLibre = useCallback(async () => {
    if (!mapContainerRef.current || !isOpen) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as any;
    delete baseStyle.projection; // Enforce Mercator projection

    const mapCenterLat = parseFloat(lat) || (centroid ? centroid.lat : 0);
    const mapCenterLng = parseFloat(lng) || (centroid ? centroid.lng : 0);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: baseStyle,
      center: [mapCenterLng, mapCenterLat],
      zoom: centroid ? 5 : 2,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 1. Overlay world bounds and gray out non-owned countries
      if (worldPolitical && worldPolitical.features && viewerCountryId) {
        const otherCountries = {
          type: "FeatureCollection",
          features: worldPolitical.features.filter(
            (f) => f.properties?._countryId !== viewerCountryId
          ),
        };
        map.addSource("other-countries", { type: "geojson", data: otherCountries as any });
        map.addLayer({
          id: "other-countries-fill",
          type: "fill",
          source: "other-countries",
          paint: {
            "fill-color": "#475569",
            "fill-opacity": 0.2,
          },
        });
      }

      // 2. Active Country borders
      if (geometry && viewerCountryId) {
        const activeColor = fillColor || (featureId ? getCountryColor(featureId) : "#6366f1");
        const activeGeo = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: geometry as any }],
        };
        map.addSource("active-country", { type: "geojson", data: activeGeo as any });
        map.addLayer({
          id: "active-country-stroke",
          type: "line",
          source: "active-country",
          paint: {
            "line-color": activeColor,
            "line-width": 2,
          },
        });

        // 3. Subdivisions
        if (subdivisions && subdivisions.length > 0) {
          const subGeo = {
            type: "FeatureCollection",
            features: subdivisions
              .filter((s: any) => s.geometry)
              .map((s: any) => ({
                type: "Feature",
                properties: {},
                geometry: s.geometry as any,
              })),
          };
          map.addSource("active-subdivisions", { type: "geojson", data: subGeo as any });
          map.addLayer({
            id: "active-subdivisions-stroke",
            type: "line",
            source: "active-subdivisions",
            paint: {
              "line-color": "#475569",
              "line-width": 0.5,
              "line-dasharray": [3, 2],
              "line-opacity": 0.5,
            },
          });
        }
      }

      // 4. Fit bounds of owned country
      if (bbox) {
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 20, maxZoom: 8, duration: 0 }
        );
      }

      // 5. Place Marker at starting coordinates
      const startMarker = new maplibregl.Marker({ color: "#f43f5e" })
        .setLngLat([mapCenterLng, mapCenterLat])
        .addTo(map);
      markerRef.current = startMarker;

      // Click listener to grab coordinates
      map.on("click", (e: any) => {
        const clickedLng = e.lngLat.lng;
        const clickedLat = e.lngLat.lat;

        setLat(clickedLat.toFixed(5));
        setLng(clickedLng.toFixed(5));

        if (markerRef.current) {
          markerRef.current.setLngLat([clickedLng, clickedLat]);
        }
      });

      setMapLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    centroid,
    geometry,
    worldPolitical,
    bbox,
    viewerCountryId,
    fillColor,
    featureId,
    subdivisions,
    isOpen,
  ]);

  // Load/Unload map
  useEffect(() => {
    if (isOpen && !isMapBundleLoading) {
      const timer = setTimeout(() => {
        initMapLibre();
      }, 100);
      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
        }
      };
    }
    return undefined;
  }, [isOpen, isMapBundleLoading, initMapLibre]);

  if (!isOpen) return null;

  const handleInsertLink = () => {
    const l = parseFloat(lat);
    const g = parseFloat(lng);
    if (isNaN(l) || isNaN(g)) return;

    if (activeTab === "coords") {
      const lbl = label.trim() ? `|${label.trim()}` : "";
      onInsert(`[[Coords:${l.toFixed(5)},${g.toFixed(5)},${zoom}${lbl}]]`);
    } else {
      const options = [
        `height=${embedHeight}`,
        `width=${embedWidth}`,
        `interactive=${embedInteractive ? "yes" : "no"}`,
      ];
      if (label.trim()) {
        options.push(`title=${label.trim()}`);
      }
      onInsert(`[[MapEmbed:${l.toFixed(5)},${g.toFixed(5)},${zoom}|${options.join("|")}]]`);
    }
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="glass-surface glass-refraction-none relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1524]/90 text-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <MapIcon className="h-5 w-5 text-emerald-400" />
              Insert Map Coords &amp; Embeds
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel: Configuration */}
            <div className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/10 bg-white/[0.02] p-6">
              {/* Tab Selector */}
              <div className="flex shrink-0 rounded-lg border border-white/10 bg-[#060e19] p-0.5">
                <button
                  onClick={() => setActiveTab("coords")}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "coords"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Coords Link
                </button>
                <button
                  onClick={() => setActiveTab("mapembed")}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "mapembed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Map Embed
                </button>
              </div>

              {/* Coordinates status */}
              <div className="grid shrink-0 grid-cols-2 gap-3 rounded-lg border border-white/5 bg-black/35 p-3">
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase">
                    Latitude (Y)
                  </span>
                  <span className="font-mono text-sm font-semibold text-zinc-200">{lat}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-500 uppercase">
                    Longitude (X)
                  </span>
                  <span className="font-mono text-sm font-semibold text-zinc-200">{lng}</span>
                </div>
              </div>

              {/* Markers Picker */}
              <div className="shrink-0 space-y-1.5">
                <label className="block text-xs font-semibold text-white/75">
                  Quick Select Existing Marker
                </label>
                <div className="max-h-36 scrollbar-thin divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-black/20 text-xs">
                  {isMapBundleLoading && (
                    <div className="flex items-center gap-1.5 p-3 text-white/50">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Loading
                      features...
                    </div>
                  )}
                  {!isMapBundleLoading &&
                    cities.map((c: any) => (
                      <button
                        key={`city-${c.id}`}
                        type="button"
                        onClick={() =>
                          handleMarkerSelect(c.coordinates[1], c.coordinates[0], c.name)
                        }
                        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="font-semibold text-white/80">{c.name}</span>
                        <span className="text-[9px] font-bold text-white/40 uppercase">
                          {c.isNationalCapital ? "Capital" : "City"}
                        </span>
                      </button>
                    ))}
                  {!isMapBundleLoading &&
                    pois.map((p: any) => (
                      <button
                        key={`poi-${p.id}`}
                        type="button"
                        onClick={() =>
                          handleMarkerSelect(p.coordinates[1], p.coordinates[0], p.name)
                        }
                        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-white/80">{p.name}</span>
                        <span className="rounded bg-white/5 px-1.5 text-[9px] text-white/40 capitalize">
                          {p.category}
                        </span>
                      </button>
                    ))}
                  {!isMapBundleLoading && cities.length === 0 && pois.length === 0 && (
                    <div className="p-3 text-center text-white/40">
                      No markers found in database.
                    </div>
                  )}
                </div>
              </div>

              {/* Shared parameters */}
              <div className="shrink-0 space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-white/75">
                    {activeTab === "coords" ? "Link Label (Required)" : "Marker Title (Optional)"}
                  </label>
                  <input
                    type="text"
                    required={activeTab === "coords"}
                    placeholder={activeTab === "coords" ? "e.g. Royal Palace" : "e.g. My Capital"}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-white/75">
                    Map Zoom level ({zoom})
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={18}
                    step={1}
                    value={zoom}
                    onChange={(e) => {
                      const newZ = parseInt(e.target.value);
                      setZoom(newZ);
                      if (mapRef.current) {
                        mapRef.current.setZoom(newZ);
                      }
                    }}
                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-emerald-500"
                  />
                </div>
              </div>

              {/* Embed parameters */}
              {activeTab === "mapembed" && (
                <div className="shrink-0 space-y-3 border-t border-white/5 pt-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/75">
                      Embed Height (px)
                    </label>
                    <input
                      type="number"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(parseInt(e.target.value) || 400)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/75">Embed Width</label>
                    <input
                      type="text"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={embedInteractive}
                      onChange={(e) => setEmbedInteractive(e.target.checked)}
                      className="rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-white/80">Interactive panning / zoom</span>
                  </label>
                </div>
              )}

              {/* Syntax preview */}
              <div className="mt-auto shrink-0 rounded border border-emerald-950 bg-[#0a182b] p-2.5 text-center font-mono text-[11px] text-emerald-400">
                {activeTab === "coords" ? (
                  <span>
                    [[Coords:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}
                    {label.trim() ? `|${label.trim()}` : ""}]]
                  </span>
                ) : (
                  <span className="break-all">
                    [[MapEmbed:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}
                    |height={embedHeight}|width={embedWidth}|interactive=
                    {embedInteractive ? "yes" : "no"}
                    {label.trim() ? `|title=${label}` : ""}]]
                  </span>
                )}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleInsertLink}
                disabled={activeTab === "coords" && !label.trim()}
                className="w-full shrink-0 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                Insert Map Feature
              </button>
            </div>

            {/* Right Panel: Map Canvas */}
            <div className="relative flex-1 bg-[#060e19]">
              {isMapBundleLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-semibold">Loading border layers...</span>
                </div>
              ) : (
                <>
                  <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
                  {/* Status Indicator overlay */}
                  <div className="pointer-events-none absolute top-4 left-4 z-10">
                    <div className="glass-surface flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 p-2.5 text-xs text-white/80 shadow-lg backdrop-blur-md">
                      <Compass className="animate-spin-slow h-4 w-4 text-emerald-400" />
                      <span>Click on map to capture pin coords</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
