"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Building,
  SystemRestart as Loader2,
  CheckCircle,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Input, fieldStyles } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { BaseModalProps } from "./types";
import { TemplateModalShell } from "./TemplateModalShell";

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
      // oxlint-disable-next-line
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
    <TemplateModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={<Building className="text-teal size-5 shrink-0" aria-hidden="true" />}
      title="Insert Business Data"
    >
      {/* Tab selection */}
      <div className="border-separator border-b p-3">
        <SegmentedControl
          aria-label="Business data mode"
          fullWidth
          size="sm"
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "search", label: "Search Approved Businesses" },
            { value: "create", label: "+ Register & Link Business" },
          ]}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "search" ? (
        <div className="space-y-4 p-6">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-subhead text-label block">Find Company</label>
            <div className="relative">
              <Search className="text-label-secondary absolute top-2.5 left-3 h-4 w-4" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search registered business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-3 pl-9"
              />
            </div>

            {/* List */}
            <div className="border-separator divide-separator bg-fill-4 rounded-control max-h-36 scrollbar-thin divide-y overflow-y-auto border">
              {searchLoading && (
                <div className="text-label-secondary text-footnote flex items-center gap-2 p-3">
                  <Loader2 className="text-label-secondary h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              )}
              {!searchLoading &&
                businesses?.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBusiness({ name: b.name })}
                    className={cn(
                      "text-headline flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
                      selectedBusiness?.name === b.name
                        ? "bg-tint-fill text-tint"
                        : "text-label hover:bg-fill-3"
                    )}
                  >
                    <span>{b.name}</span>
                    <span className="bg-fill-3 text-label-secondary text-footnote rounded-full px-2 py-0.5 capitalize">
                      {b.category}
                    </span>
                  </button>
                ))}
              {!searchLoading && businesses?.length === 0 && (
                <div className="text-label-secondary text-footnote p-3 text-center">
                  No matching businesses found.
                </div>
              )}
            </div>
          </div>

          {/* Selected Business */}
          {selectedBusiness && (
            <div className="rounded-control bg-tint-fill flex items-center justify-between p-3">
              <div>
                <span className="text-caption text-tint block">Ready to Link</span>
                <span className="text-label text-headline">{selectedBusiness.name}</span>
              </div>
              {createSuccess && (
                <span className="bg-green/15 text-caption text-green flex items-center gap-1 rounded-full px-2 py-0.5">
                  <CheckCircle className="h-3 w-3" /> Registered
                </span>
              )}
            </div>
          )}

          {/* Field selection */}
          <div className="space-y-2">
            <label className="text-subhead text-label block">Select Attribute Field</label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className={cn(
                fieldStyles,
                "rounded-control text-body h-(--control-height) w-full cursor-pointer px-3"
              )}
            >
              {BUSINESS_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {selectedBusiness && (
            <div className="rounded-control bg-surface-secondary text-footnote text-label-secondary p-3 text-center font-mono">
              Syntax: {`{{BusinessData:${selectedBusiness.name}:${selectedField}}}`}
            </div>
          )}

          {/* Footer */}
          <div className="border-separator flex items-center justify-end gap-3 border-t pt-4">
            <Button variant="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleInsertBusiness} disabled={!selectedBusiness}>
              Insert Business Data
            </Button>
          </div>
        </div>
      ) : (
        /* Create and Link business POI */
        <form
          onSubmit={handleCreateBusiness}
          className="max-h-[60vh] scrollbar-thin space-y-4 overflow-y-auto p-6"
        >
          {!viewerCountryId ? (
            <div className="rounded-row border-red/25 bg-red/10 space-y-2 border p-4 text-center">
              <AlertTriangle className="text-red mx-auto h-8 w-8" />
              <h4 className="text-headline text-red">Registration Locked</h4>
              <p className="text-label-secondary text-footnote">
                Only country owners can construct new business points of interest in the database.
                You can type a business name in the search tab to reference it manually if it
                exists.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-subhead text-label block">Business/Company Name</label>
                <Input
                  ref={createInputRef}
                  type="text"
                  required
                  placeholder="e.g. Caphira Logistics"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-subhead text-label block">POI Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={cn(
                    fieldStyles,
                    "rounded-control text-body h-(--control-height) w-full cursor-pointer px-3"
                  )}
                >
                  <option value="commercial">Commercial Shop / Retail</option>
                  <option value="office">Corporate Office / Finance</option>
                  <option value="industrial">Industrial Facility</option>
                  <option value="factory">Factory / Manufacturing</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-subhead text-label block">Latitude (Y)</label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. 12.3456"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-subhead text-label block">Longitude (X)</label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. 45.6789"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-subhead text-label block">Short Description</label>
                <Textarea
                  rows={2}
                  placeholder="Short summary of this corporate establishment..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="resize-none"
                />
              </div>

              {createError && (
                <div className="rounded-control bg-red/10 text-footnote text-red flex items-center gap-1.5 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <Button variant="gray" type="button" onClick={() => setActiveTab("search")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPoiMutation.isPending}>
                  {createPoiMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create &amp; Link
                </Button>
              </div>
            </>
          )}
        </form>
      )}
    </TemplateModalShell>
  );
}
