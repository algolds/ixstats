"use client";
// src/app/(wiki-os)/util/templates/page.tsx
// WikiOS Master Template Registry & Interactive Visual Infobox Suite

import { cn } from "~/lib/utils";
import React, { useState, useMemo } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import { ViewGrid, Search, Code, Check, Spark, Packages, Copy, Eye, List } from "iconoir-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Badge } from "~/components/ui/badge";
import { MASTER_TEMPLATE_PRESETS } from "~/lib/wiki-os/templates/master-presets";
import { VisualInfoboxPreviewCard } from "~/components/wiki-os/templates/VisualInfoboxPreviewCard";

export default function WikiTemplatesPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("Infobox country");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("sovereign");
  const [viewMode, setViewMode] = useState<"visual" | "schema" | "wikitext">("visual");
  const [copied, setCopied] = useState(false);

  const { data: searchResults, isLoading } = api.wikios.searchTemplates.useQuery({
    query: search,
    category: activeCategory === "all" ? undefined : activeCategory,
    limit: 50,
  });

  const { data: templateData } = api.wikios.getTemplateData.useQuery(
    { title: selectedTemplateName },
    { enabled: !!selectedTemplateName }
  );

  const categories = [
    { id: "all", label: "All Suites" },
    { id: "sovereign", label: "🏛️ Sovereign & Lands" },
    { id: "biography", label: "👤 Biographies" },
    { id: "defense", label: "⚔️ Defense & Fleet" },
    { id: "economy", label: "🏢 Enterprise & Infra" },
    { id: "engine", label: "⚡ Live Engine Sync" },
    { id: "formatting", label: "📜 Layout & Citations" },
  ];

  const presetMatch = MASTER_TEMPLATE_PRESETS.find(
    (t) => t.name.toLowerCase() === selectedTemplateName.toLowerCase()
  );

  React.useEffect(() => {
    if (presetMatch?.variants && presetMatch.variants.length > 0) {
      setSelectedVariantId(presetMatch.variants[0]!.id);
    }
  }, [presetMatch]);

  const rawParams =
    (templateData?.templateData as any)?.params || (templateData as any)?.params || {};
  const paramEntries = Object.entries(rawParams);

  // Active Variant Label
  const activeVariant = presetMatch?.variants?.find((v) => v.id === selectedVariantId);

  // Normalized param objects for the visual preview
  const previewParams = useMemo(() => {
    if (presetMatch?.params) {
      return presetMatch.params;
    }
    return paramEntries.map(([k, p]: [string, any]) => ({
      name: k,
      label: p?.label || k.replace(/_/g, " "),
      example: p?.example || p?.default || `Sample ${k}`,
      type: p?.type || "string",
    }));
  }, [presetMatch, paramEntries]);

  // Generate sample wikitext template
  const sampleWikitext = useMemo(() => {
    const lines = [`{{${selectedTemplateName}`];
    if (presetMatch?.params) {
      for (const p of presetMatch.params) {
        if (!p.variantOnly || p.variantOnly.includes(selectedVariantId)) {
          lines.push(`| ${p.name.padEnd(20)} = ${p.example || ""}`);
        }
      }
    } else if (paramEntries.length > 0) {
      for (const [key, p] of paramEntries as Array<[string, any]>) {
        lines.push(`| ${key.padEnd(20)} = ${p?.example || p?.default || ""}`);
      }
    } else {
      lines.push(`| name                 = `);
    }
    lines.push("}}");
    return lines.join("\n");
  }, [selectedTemplateName, presetMatch, selectedVariantId, paramEntries]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(sampleWikitext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <WikiOSLayout title="Template Registry & Infobox Suite">
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-16">
        {/* Header Banner */}
        <div className="border-separator bg-surface rounded-card border p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3.5">
              <div className="bg-tint/15 text-tint border-tint/20 rounded-card border p-3">
                <ViewGrid className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-label text-title-2">Template Registry & Infobox Suite</h1>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Unified polymorphic realm factbooks, dynamic variant schemas, and live simulation
                  data connectors
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className="bg-tint/10 text-tint border-tint/30 text-footnote flex w-fit items-center gap-1.5 px-3 py-1.5"
            >
              <Spark className="h-3.5 w-3.5" /> Polymorphic Engine & Visual Factbook
            </Badge>
          </div>

          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates (e.g. Country, Ship, Person, Citation)..."
                className="border-separator bg-surface text-label placeholder:text-label-tertiary focus:border-tint rounded-row text-footnote w-full border py-2 pr-4 pl-10 focus:outline-none"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-cuelume-press="soft"
                  data-cuelume-hover="tick"
                  onClick={() => setActiveCategory(c.id)}
                  className={cn(
                    "rounded-row text-caption cursor-pointer px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                    activeCategory === c.id
                      ? "bg-tint/20 text-tint border-tint/30 border font-semibold"
                      : "bg-fill-3 text-label-secondary hover:bg-fill-3 hover:text-label border border-transparent"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Master Catalog & Inspector Workspace */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Template Catalog (4 cols) */}
          <div className="border-separator bg-surface rounded-card h-[720px] space-y-2 overflow-y-auto border p-4 lg:col-span-4">
            <div className="text-label-secondary text-eyebrow flex items-center justify-between px-2 py-1">
              <span>Curated Templates ({searchResults?.templates?.length ?? 0})</span>
            </div>

            {isLoading ? (
              <div className="text-label-secondary text-footnote py-12 text-center">
                Loading template registry...
              </div>
            ) : searchResults?.templates && searchResults.templates.length > 0 ? (
              searchResults.templates.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  data-cuelume-press="soft"
                  data-cuelume-hover="tick"
                  onClick={() => setSelectedTemplateName(tmpl.name)}
                  className={cn(
                    "rounded-card text-caption flex w-full cursor-pointer flex-col gap-1 px-3.5 py-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                    selectedTemplateName.toLowerCase() === tmpl.name.toLowerCase()
                      ? "bg-tint/15 border-tint/30 text-label shadow-card border font-semibold"
                      : "hover:bg-fill-3 text-label-secondary hover:text-label border border-transparent"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-label truncate font-semibold">{tmpl.name}</span>
                    {tmpl.isCanonical && (
                      <span className="bg-tint/20 text-tint rounded-control-sm text-eyebrow px-1.5 py-0.5">
                        Master
                      </span>
                    )}
                  </div>
                  {tmpl.description && (
                    <span className="text-label-secondary text-footnote line-clamp-1">
                      {tmpl.description}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="text-label-secondary text-footnote py-12 text-center">
                No templates match query.
              </div>
            )}
          </div>

          {/* Right Column: Template Inspector & Visual Preview (8 cols) */}
          <div className="border-separator bg-surface rounded-card flex min-h-[720px] flex-col justify-between space-y-6 border p-6 lg:col-span-8">
            <div className="space-y-5">
              {/* Title & View Switcher Bar */}
              <div className="border-separator flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-label text-title-2">{selectedTemplateName}</h2>
                    <span className="bg-tint/15 text-tint text-eyebrow rounded-full px-2.5 py-0.5">
                      {templateData?.category || "Template"}
                    </span>
                  </div>
                  <p className="text-label-secondary text-footnote mt-0.5">
                    {templateData?.description || "Canonical WikiOS Schema & Component"}
                  </p>
                </div>

                {/* View Mode Segmented Bar */}
                <div className="flex items-center gap-2">
                  <div className="border-separator bg-fill-3 rounded-row flex items-center border p-1">
                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("visual")}
                      className={cn(
                        "rounded-control text-caption relative z-10 flex cursor-pointer items-center gap-1.5 px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                        viewMode === "visual"
                          ? "font-semibold text-black"
                          : "text-label-secondary hover:text-label"
                      )}
                    >
                      {viewMode === "visual" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-tint rounded-control absolute inset-0 -z-10"
                        />
                      )}
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visual Preview</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("schema")}
                      className={cn(
                        "rounded-control text-caption relative z-10 flex cursor-pointer items-center gap-1.5 px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                        viewMode === "schema"
                          ? "font-semibold text-black"
                          : "text-label-secondary hover:text-label"
                      )}
                    >
                      {viewMode === "schema" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-tint rounded-control absolute inset-0 -z-10"
                        />
                      )}
                      <List className="h-3.5 w-3.5" />
                      <span>Parameters</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("wikitext")}
                      className={cn(
                        "rounded-control text-caption relative z-10 flex cursor-pointer items-center gap-1.5 px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                        viewMode === "wikitext"
                          ? "font-semibold text-black"
                          : "text-label-secondary hover:text-label"
                      )}
                    >
                      {viewMode === "wikitext" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-tint rounded-control absolute inset-0 -z-10"
                        />
                      )}
                      <Code className="h-3.5 w-3.5" />
                      <span>Wikitext</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    data-cuelume-press="tap"
                    onClick={handleCopy}
                    className="border-separator bg-fill-2 text-label hover:bg-fill-3 rounded-row text-caption inline-flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                  >
                    {copied ? (
                      <Check className="text-green h-3.5 w-3.5" />
                    ) : (
                      <Copy className="text-tint h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Variant Switcher Pill Bar */}
              {presetMatch?.variants && presetMatch.variants.length > 0 && (
                <div className="border-separator bg-fill-4 rounded-card space-y-2 border p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-label text-subhead">Polymorphic Variant / Subtype</span>
                    <span className="text-label-secondary text-footnote">
                      Swaps live field sets & visual rendering
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {presetMatch.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        data-cuelume-press="soft"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={cn(
                          "rounded-row text-caption cursor-pointer px-3 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                          selectedVariantId === v.id
                            ? "bg-tint shadow-card font-semibold text-black"
                            : "bg-fill-3 text-label-secondary hover:bg-fill-3 hover:text-label"
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── View Mode: 1. Visual Infobox Preview ── */}
              {viewMode === "visual" && (
                <div className="flex flex-col items-start justify-center gap-6 py-2 xl:flex-row">
                  <div className="mx-auto shrink-0 xl:mx-0">
                    <VisualInfoboxPreviewCard
                      templateName={selectedTemplateName}
                      variantId={selectedVariantId}
                      variantLabel={activeVariant?.label}
                      category={templateData?.category || presetMatch?.category}
                      params={previewParams}
                    />
                  </div>

                  <div className="w-full flex-1 space-y-4">
                    {/* Live Schema Metadata Card */}
                    <div className="border-separator bg-fill-4 rounded-card space-y-3 border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-label text-caption font-semibold">
                          Factbook Specification
                        </span>
                        <Badge
                          variant="outline"
                          className="border-separator text-footnote tabular-nums"
                        >
                          {previewParams.length} parameters
                        </Badge>
                      </div>

                      <div className="text-footnote grid grid-cols-2 gap-2">
                        <div className="bg-surface border-separator rounded-row border p-2.5">
                          <div className="text-label-secondary text-subhead">Template Class</div>
                          <div className="text-label mt-0.5 font-medium">
                            {templateData?.category || presetMatch?.category || "Factbook"}
                          </div>
                        </div>
                        <div className="bg-surface border-separator rounded-row border p-2.5">
                          <div className="text-label-secondary text-eyebrow">Active Subtype</div>
                          <div className="text-label mt-0.5 font-medium">
                            {activeVariant?.label || "Standard"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instant Wikitext Snippet */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-label-secondary text-subhead">
                          Wikitext Invocation
                        </span>
                        <button
                          type="button"
                          data-cuelume-press="tap"
                          onClick={handleCopy}
                          className="text-tint text-footnote cursor-pointer transition-transform hover:underline active:scale-[0.98]"
                        >
                          {copied ? "Copied wikitext" : "Copy wikitext"}
                        </button>
                      </div>
                      <pre className="border-separator bg-surface text-label rounded-card text-footnote max-h-72 overflow-y-auto border p-3.5 leading-relaxed tabular-nums">
                        {sampleWikitext}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* ── View Mode: 2. Schema Parameters Matrix ── */}
              {viewMode === "schema" && (
                <div className="space-y-3">
                  <h3 className="text-label-secondary text-subhead">
                    Parameters ({paramEntries.length || previewParams.length})
                  </h3>

                  {previewParams.length === 0 ? (
                    <div className="text-label-secondary text-footnote py-12 text-center">
                      Standard template without explicit parameters.
                    </div>
                  ) : (
                    <div className="grid max-h-[460px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                      {previewParams.map((p) => (
                        <div
                          key={p.name}
                          className="border-separator bg-surface rounded-card space-y-1 border p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-label text-caption font-semibold tabular-nums">
                              {p.name}
                            </span>
                            {p.type && (
                              <Badge variant="secondary" className="text-footnote">
                                {p.type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-label-secondary text-footnote line-clamp-2">
                            {p.label || p.example || "Parameter field"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── View Mode: 3. Full Raw Wikitext ── */}
              {viewMode === "wikitext" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-label-secondary text-caption font-semibold">
                      Complete Wikitext Starter Code
                    </span>
                    <span className="text-label-secondary text-footnote">
                      Ready to paste into source editor
                    </span>
                  </div>
                  <pre className="border-separator bg-surface text-label rounded-card text-footnote max-h-[460px] overflow-y-auto border p-4 leading-relaxed tabular-nums">
                    {sampleWikitext}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </WikiOSLayout>
  );
}
