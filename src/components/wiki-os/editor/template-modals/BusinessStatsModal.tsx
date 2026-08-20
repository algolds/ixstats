"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, Building, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "~/trpc/react";
import { Portal, type BaseModalProps } from "./types";

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

  const { data: businesses, isLoading: searchLoading } = api.wikios.searchBusinesses.useQuery(
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
    } catch (err: unknown) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Failed to register new business POI.");
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100080] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <div
          className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card/95 text-foreground shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-card/95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
              <Building className="h-5 w-5 text-cyan-400" />
              Insert Business Data
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors active:scale-95 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-border bg-muted/20 p-1 dark:border-white/10 dark:bg-white/5">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                activeTab === "search"
                  ? "bg-cyan-500/20 text-cyan-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Search Approved Businesses
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                activeTab === "create"
                  ? "bg-cyan-500/20 text-cyan-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
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
                <label className="text-foreground block text-xs font-semibold">Find Company</label>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search registered business..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
                  />
                </div>

                {/* List */}
                <div className="scrollbar-thin border-border divide-border bg-muted/20 max-h-36 divide-y overflow-y-auto rounded-lg border">
                  {searchLoading && (
                    <div className="text-muted-foreground flex items-center gap-2 p-3 text-xs">
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
                            : "text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-[10px] capitalize">
                          {b.category}
                        </span>
                      </button>
                    ))}
                  {!searchLoading && businesses?.length === 0 && (
                    <div className="text-muted-foreground p-3 text-center text-xs">
                      No matching businesses found.
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Business */}
              {selectedBusiness && (
                <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
                  <div>
                    <span className="block text-xs font-semibold text-cyan-400/80">
                      Ready to Link
                    </span>
                    <span className="text-foreground text-sm font-bold">{selectedBusiness.name}</span>
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
                <label className="text-foreground block text-xs font-semibold">
                  Select Attribute Field
                </label>
                <select
                  value={selectedField}
                  onChange={(e) => setSelectedField(e.target.value)}
                  className="border-input bg-secondary text-foreground focus:ring-ring w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                >
                  {BUSINESS_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBusiness && (
                <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-center font-mono text-xs text-cyan-400">
                  Syntax: {`{{BusinessData:${selectedBusiness.name}:${selectedField}}}`}
                </div>
              )}

              {/* Footer */}
              <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
                <button
                  onClick={onClose}
                  className="text-foreground hover:bg-muted rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsertBusiness}
                  disabled={!selectedBusiness}
                  className="animate-pulse-subtle rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-500 active:scale-[0.97] disabled:opacity-50"
                >
                  Insert Business Data
                </button>
              </div>
            </div>
          ) : (
            /* Create and Link business POI */
            <form
              onSubmit={handleCreateBusiness}
              className="scrollbar-thin max-h-[60vh] space-y-4 overflow-y-auto p-6"
            >
              {!viewerCountryId ? (
                <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
                  <h4 className="text-sm font-bold text-red-200">Registration Locked</h4>
                  <p className="text-muted-foreground text-xs">
                    Only country owners can construct new business points of interest in the
                    database. You can type a business name in the search tab to reference it
                    manually if it exists.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-foreground block text-xs font-semibold">
                      Business/Company Name
                    </label>
                    <input
                      ref={createInputRef}
                      type="text"
                      required
                      placeholder="e.g. Caphira Logistics"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-foreground block text-xs font-semibold">
                      POI Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="border-input bg-secondary text-foreground focus:ring-ring w-full cursor-pointer rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    >
                      <option value="commercial">Commercial Shop / Retail</option>
                      <option value="office">Corporate Office / Finance</option>
                      <option value="industrial">Industrial Facility</option>
                      <option value="factory">Factory / Manufacturing</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-foreground block text-xs font-semibold">
                        Latitude (Y)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12.3456"
                        value={newLat}
                        onChange={(e) => setNewLat(e.target.value)}
                        className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-foreground block text-xs font-semibold">
                        Longitude (X)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 45.6789"
                        value={newLng}
                        onChange={(e) => setNewLng(e.target.value)}
                        className="border-input bg-secondary text-foreground focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-foreground block text-xs font-semibold">
                      Short Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Short summary of this corporate establishment..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="border-input bg-secondary text-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
                      className="text-foreground hover:bg-muted rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPoiMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-500 active:scale-[0.97] disabled:opacity-50"
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
