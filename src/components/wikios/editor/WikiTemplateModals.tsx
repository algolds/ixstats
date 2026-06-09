// src/components/wikios/editor/WikiTemplateModals.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  MapPin,
  Building,
  BarChart2,
  Globe,
  Flag,
  Plus,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Compass,
  Map as MapIcon,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { api } from "~/trpc/react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { buildBaseStyle, getCountryColor } from "~/lib/map-config";
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
        <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] glass-surface glass-refraction border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#0c1524]/90 text-white" onClick={(e) => e.stopPropagation()}>
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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Country Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Moscakee"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Native Name</label>
                <input
                  type="text"
                  value={formData.nativeName}
                  onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                  placeholder="e.g. Mosckea"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Capital City</label>
                <input
                  type="text"
                  value={formData.capital}
                  onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                  placeholder="e.g. Ostrava"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Motto</label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  placeholder="e.g. Freedom and Unity"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Currency Name</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="e.g. Crown"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="e.g. 👑"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Government Type</label>
                <input
                  type="text"
                  value={formData.government}
                  onChange={(e) => setFormData({ ...formData, government: e.target.value })}
                  placeholder="e.g. Constitutional Monarchy"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Leader / Ruler</label>
                <input
                  type="text"
                  value={formData.leader}
                  onChange={(e) => setFormData({ ...formData, leader: e.target.value })}
                  placeholder="e.g. King Michael"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Flag Image filename</label>
                <input
                  type="text"
                  value={formData.flagImage}
                  onChange={(e) => setFormData({ ...formData, flagImage: e.target.value })}
                  placeholder="e.g. Flag_of_Moscakee.png"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Map Image filename</label>
                <input
                  type="text"
                  value={formData.mapImage}
                  onChange={(e) => setFormData({ ...formData, mapImage: e.target.value })}
                  placeholder="e.g. Map_of_Moscakee.png"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
        <div className="relative flex flex-col w-full max-w-lg glass-surface glass-refraction border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#0c1524]/90 text-white" onClick={(e) => e.stopPropagation()}>
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
          <div className="p-6 space-y-6">
            {/* Step 1: Select Country */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/75">1. Select Country</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <input
                  ref={firstInputRef}
                  type="text"
                  placeholder="Search country name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-white/10 bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* List Results */}
              <div className="border border-white/10 rounded-lg max-h-32 overflow-y-auto bg-black/20 divide-y divide-white/5 scrollbar-thin">
                {isLoading && (
                  <div className="p-3 text-xs text-white/50 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </div>
                )}
                {!isLoading && countries?.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCountry({ id: c.id, name: c.name })}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      selectedCountry?.id === c.id ? "bg-amber-500/20 text-amber-400 font-semibold" : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {c.flagUrl && (
                        <img src={c.flagUrl} alt="" className="h-3 w-5 object-cover rounded-sm border border-white/10" />
                      )}
                      {c.name}
                    </span>
                    {viewerCountryId && c.id === viewerCountryId && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">
                        My Country
                      </span>
                    )}
                  </button>
                ))}
                {!isLoading && countries?.length === 0 && (
                  <div className="p-3 text-xs text-white/40 text-center">No countries found.</div>
                )}
              </div>
            </div>

            {/* Selected Country Badge */}
            {selectedCountry && (
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-white/40 block">Selected Country</span>
                  <span className="text-sm font-bold text-white">{selectedCountry.name}</span>
                </div>
                <Compass className="h-5 w-5 text-amber-400" />
              </div>
            )}

            {/* Step 2: Select Stat */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/75">2. Choose Stat Attribute</label>
              <select
                value={selectedStat}
                onChange={(e) => setSelectedStat(e.target.value)}
                className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none bg-no-repeat bg-[right_12px_center] cursor-pointer"
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
              <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg text-xs font-mono text-emerald-400 text-center">
                Syntax: {viewerCountryId && selectedCountry.id === viewerCountryId
                  ? `{{MyCountry:${selectedStat}}}`
                  : `{{CountryData:${selectedCountry.name}:${selectedStat}}}`}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertStat}
                disabled={!selectedCountry}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black transition-colors"
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
        <div className="relative flex flex-col w-full max-w-lg glass-surface glass-refraction border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#0c1524]/90 text-white" onClick={(e) => e.stopPropagation()}>
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
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "search" ? "bg-cyan-500/20 text-cyan-400" : "text-white/60 hover:text-white"
              }`}
            >
              Search Approved Businesses
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "create" ? "bg-cyan-500/20 text-cyan-400" : "text-white/60 hover:text-white"
              }`}
            >
              + Register &amp; Link Business
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "search" ? (
            <div className="p-6 space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/75">Find Company</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search registered business..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border border-white/10 bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* List */}
                <div className="border border-white/10 rounded-lg max-h-36 overflow-y-auto bg-black/20 divide-y divide-white/5 scrollbar-thin">
                  {searchLoading && (
                    <div className="p-3 text-xs text-white/50 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                      Searching...
                    </div>
                  )}
                  {!searchLoading && businesses?.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBusiness({ name: b.name })}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                        selectedBusiness?.name === b.name
                          ? "bg-cyan-500/20 text-cyan-400 font-semibold"
                          : "hover:bg-white/5 text-white/80"
                      }`}
                    >
                      <span>{b.name}</span>
                      <span className="text-[10px] opacity-60 capitalize bg-white/5 px-2 py-0.5 rounded">
                        {b.category}
                      </span>
                    </button>
                  ))}
                  {!searchLoading && businesses?.length === 0 && (
                    <div className="p-3 text-xs text-white/40 text-center">No matching businesses found.</div>
                  )}
                </div>
              </div>

              {/* Selected Business */}
              {selectedBusiness && (
                <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-cyan-400/60 block font-semibold">Ready to Link</span>
                    <span className="text-sm font-bold text-white">{selectedBusiness.name}</span>
                  </div>
                  {createSuccess && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                      <CheckCircle className="h-3 w-3" /> Registered
                    </span>
                  )}
                </div>
              )}

              {/* Field selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/75">Select Attribute Field</label>
                <select
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)}
                  className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer appearance-none bg-[#121c2c]"
                >
                  {BUSINESS_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBusiness && (
                <div className="bg-[#0e223a]/40 border border-cyan-950 p-2.5 rounded font-mono text-xs text-cyan-400 text-center">
                  Syntax: {`{{BusinessData:${selectedBusiness.name}:${selectedField}}}`}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertBusiness}
                  disabled={!selectedBusiness}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors animate-pulse-subtle"
                >
                  Insert Business Data
                </button>
              </div>
            </div>
          ) : (
            /* Create and Link business POI */
            <form onSubmit={handleCreateBusiness} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {!viewerCountryId ? (
                <div className="bg-red-500/10 border border-red-500/25 p-4 rounded-xl space-y-2 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                  <h4 className="text-sm font-bold text-red-200">Registration Locked</h4>
                  <p className="text-xs text-white/60">
                    Only country owners can construct new business points of interest in the database.
                    You can type a business name in the search tab to reference it manually if it exists.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">Business/Company Name</label>
                    <input
                      ref={createInputRef}
                      type="text"
                      required
                      placeholder="e.g. Caphira Logistics"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">POI Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer bg-[#121c2c]"
                    >
                      <option value="commercial">Commercial Shop / Retail</option>
                      <option value="office">Corporate Office / Finance</option>
                      <option value="industrial">Industrial Facility</option>
                      <option value="factory">Factory / Manufacturing</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-white/75">Latitude (Y)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12.3456"
                        value={newLat}
                        onChange={(e) => setNewLat(e.target.value)}
                        className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-white/75">Longitude (X)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 45.6789"
                        value={newLng}
                        onChange={(e) => setNewLng(e.target.value)}
                        className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-white/75">Short Description</label>
                    <textarea
                      rows={2}
                      placeholder="Short summary of this corporate establishment..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    />
                  </div>

                  {createError && (
                    <div className="bg-red-500/10 border border-red-500/25 p-2 rounded text-xs text-red-400 flex gap-1.5 items-center">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab("search")}
                      className="px-4 py-2 text-sm font-semibold rounded-lg text-white hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPoiMutation.isPending}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors"
                    >
                      {createPoiMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
          features: worldPolitical.features.filter((f) => f.properties?._countryId !== viewerCountryId),
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
  }, [centroid, geometry, worldPolitical, bbox, viewerCountryId, fillColor, featureId, subdivisions, isOpen]);

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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
        <div className="relative flex flex-col w-full max-w-5xl h-[85vh] glass-surface glass-refraction border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#0c1524]/90 text-white" onClick={(e) => e.stopPropagation()}>
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
            <div className="w-80 border-r border-white/10 p-6 flex flex-col gap-5 overflow-y-auto bg-white/[0.02] shrink-0">
              {/* Tab Selector */}
              <div className="flex border border-white/10 bg-[#060e19] p-0.5 rounded-lg shrink-0">
                <button
                  onClick={() => setActiveTab("coords")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    activeTab === "coords" ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:text-white"
                  }`}
                >
                  Coords Link
                </button>
                <button
                  onClick={() => setActiveTab("mapembed")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    activeTab === "mapembed" ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:text-white"
                  }`}
                >
                  Map Embed
                </button>
              </div>

              {/* Coordinates status */}
              <div className="grid grid-cols-2 gap-3 bg-black/35 border border-white/5 p-3 rounded-lg shrink-0">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Latitude (Y)</span>
                  <span className="text-sm font-semibold font-mono text-zinc-200">{lat}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Longitude (X)</span>
                  <span className="text-sm font-semibold font-mono text-zinc-200">{lng}</span>
                </div>
              </div>

              {/* Markers Picker */}
              <div className="space-y-1.5 shrink-0">
                <label className="block text-xs font-semibold text-white/75">Quick Select Existing Marker</label>
                <div className="border border-white/10 rounded-lg max-h-36 overflow-y-auto bg-black/20 divide-y divide-white/5 scrollbar-thin text-xs">
                  {isMapBundleLoading && (
                    <div className="p-3 text-white/50 flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Loading features...
                    </div>
                  )}
                  {!isMapBundleLoading && cities.map((c: any) => (
                    <button
                      key={`city-${c.id}`}
                      type="button"
                      onClick={() => handleMarkerSelect(c.coordinates[1], c.coordinates[0], c.name)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <span className="font-semibold text-white/80">{c.name}</span>
                      <span className="text-[9px] text-white/40 uppercase font-bold">
                        {c.isNationalCapital ? "Capital" : "City"}
                      </span>
                    </button>
                  ))}
                  {!isMapBundleLoading && pois.map((p: any) => (
                    <button
                      key={`poi-${p.id}`}
                      type="button"
                      onClick={() => handleMarkerSelect(p.coordinates[1], p.coordinates[0], p.name)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <span className="text-white/80">{p.name}</span>
                      <span className="text-[9px] text-white/40 capitalize bg-white/5 px-1.5 rounded">
                        {p.category}
                      </span>
                    </button>
                  ))}
                  {!isMapBundleLoading && cities.length === 0 && pois.length === 0 && (
                    <div className="p-3 text-white/40 text-center">No markers found in database.</div>
                  )}
                </div>
              </div>

              {/* Shared parameters */}
              <div className="space-y-3 shrink-0">
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
                    className="w-full border border-white/10 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-white/75">Map Zoom level ({zoom})</label>
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
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              {/* Embed parameters */}
              {activeTab === "mapembed" && (
                <div className="space-y-3 border-t border-white/5 pt-3 shrink-0">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/75">Embed Height (px)</label>
                    <input
                      type="number"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(parseInt(e.target.value) || 400)}
                      className="w-full border border-white/10 bg-white/5 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/75">Embed Width</label>
                    <input
                      type="text"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(e.target.value)}
                      className="w-full border border-white/10 bg-white/5 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer py-1">
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
              <div className="mt-auto bg-[#0a182b] border border-emerald-950 p-2.5 rounded text-[11px] font-mono text-emerald-400 text-center shrink-0">
                {activeTab === "coords" ? (
                  <span>[[Coords:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}{label.trim() ? `|${label.trim()}` : ""}]]</span>
                ) : (
                  <span className="break-all">[[MapEmbed:{parseFloat(lat).toFixed(4)},{parseFloat(lng).toFixed(4)},{zoom}|height={embedHeight}|width={embedWidth}|interactive={embedInteractive ? "yes" : "no"}{label.trim() ? `|title=${label}` : ""}]]</span>
                )}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleInsertLink}
                disabled={activeTab === "coords" && !label.trim()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
              >
                Insert Map Feature
              </button>
            </div>

            {/* Right Panel: Map Canvas */}
            <div className="flex-1 relative bg-[#060e19]">
              {isMapBundleLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  <span className="text-xs font-semibold">Loading border layers...</span>
                </div>
              ) : (
                <>
                  <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
                  {/* Status Indicator overlay */}
                  <div className="absolute top-4 left-4 pointer-events-none z-10">
                    <div className="glass-surface bg-black/70 border border-white/10 rounded-lg p-2.5 text-xs text-white/80 flex items-center gap-2 shadow-lg backdrop-blur-md">
                      <Compass className="h-4 w-4 text-emerald-400 animate-spin-slow" />
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
