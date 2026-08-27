// src/app/(wiki-os)/util/templates/page.tsx
// WikiOS Master Template Registry & Interactive Visual Infobox Suite
"use client";

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
        <div className="border-border/60 bg-card/60 rounded-3xl border p-6 shadow-xs backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3.5">
              <div className="bg-wiki/15 text-wiki border-wiki/20 rounded-2xl border p-3 shadow-inner">
                <ViewGrid className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-foreground text-xl font-bold">
                  Template Registry & Infobox Suite
                </h1>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Unified polymorphic realm factbooks, dynamic variant schemas, and live simulation
                  data connectors
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className="bg-wiki/10 text-wiki border-wiki/30 flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Spark className="h-3.5 w-3.5" /> Polymorphic Engine & Visual Factbook
            </Badge>
          </div>

          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates (e.g. Country, Ship, Person, Citation)..."
                className="border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground/60 focus:border-wiki w-full rounded-xl border py-2 pr-4 pl-10 text-xs shadow-inner focus:outline-none"
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
                  className={`cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                    activeCategory === c.id
                      ? "bg-wiki/20 text-wiki border-wiki/30 border font-bold shadow-xs"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                  }`}
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
          <div className="border-border/60 bg-card/40 h-[720px] space-y-2 overflow-y-auto rounded-3xl border p-4 backdrop-blur-xl lg:col-span-4">
            <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-[11px] font-bold tracking-wider uppercase">
              <span>Curated Templates ({searchResults?.templates?.length ?? 0})</span>
            </div>

            {isLoading ? (
              <div className="text-muted-foreground py-12 text-center text-xs">
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
                  className={`flex w-full cursor-pointer flex-col gap-1 rounded-2xl px-3.5 py-3 text-left text-xs transition-all active:scale-[0.98] ${
                    selectedTemplateName.toLowerCase() === tmpl.name.toLowerCase()
                      ? "bg-wiki/15 border-wiki/30 text-foreground border font-semibold shadow-sm"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-foreground truncate font-bold">{tmpl.name}</span>
                    {tmpl.isCanonical && (
                      <span className="bg-wiki/20 text-wiki rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                        Master
                      </span>
                    )}
                  </div>
                  {tmpl.description && (
                    <span className="text-muted-foreground line-clamp-1 text-[11px]">
                      {tmpl.description}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="text-muted-foreground py-12 text-center text-xs">
                No templates match query.
              </div>
            )}
          </div>

          {/* Right Column: Template Inspector & Visual Preview (8 cols) */}
          <div className="border-border/60 bg-card/40 flex min-h-[720px] flex-col justify-between space-y-6 rounded-3xl border p-6 backdrop-blur-xl lg:col-span-8">
            <div className="space-y-5">
              {/* Title & View Switcher Bar */}
              <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-xl font-bold">{selectedTemplateName}</h2>
                    <span className="bg-wiki/15 text-wiki rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase">
                      {templateData?.category || "Template"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {templateData?.description || "Canonical WikiOS Schema & Component"}
                  </p>
                </div>

                {/* View Mode Segmented Bar */}
                <div className="flex items-center gap-2">
                  <div className="border-border/60 bg-secondary/50 flex items-center rounded-xl border p-1 shadow-inner">
                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("visual")}
                      className={`relative z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                        viewMode === "visual"
                          ? "font-bold text-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "visual" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-wiki absolute inset-0 -z-10 rounded-lg shadow-xs"
                        />
                      )}
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visual Preview</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("schema")}
                      className={`relative z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                        viewMode === "schema"
                          ? "font-bold text-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "schema" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-wiki absolute inset-0 -z-10 rounded-lg shadow-xs"
                        />
                      )}
                      <List className="h-3.5 w-3.5" />
                      <span>Parameters</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("wikitext")}
                      className={`relative z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                        viewMode === "wikitext"
                          ? "font-bold text-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "wikitext" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="bg-wiki absolute inset-0 -z-10 rounded-lg shadow-xs"
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
                    className="border-border/60 bg-secondary/80 text-foreground hover:bg-secondary inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="text-wiki h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Variant Switcher Pill Bar */}
              {presetMatch?.variants && presetMatch.variants.length > 0 && (
                <div className="border-border/40 bg-secondary/25 space-y-2 rounded-2xl border p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-[11px] font-bold tracking-wider uppercase">
                      Polymorphic Variant / Subtype
                    </span>
                    <span className="text-muted-foreground text-[10px]">
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
                        className={`cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                          selectedVariantId === v.id
                            ? "bg-wiki font-bold text-black shadow-md"
                            : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
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
                    <div className="border-border/40 bg-secondary/15 space-y-3 rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground text-xs font-bold">
                          Factbook Specification
                        </span>
                        <Badge variant="outline" className="border-border/60 font-mono text-[10px]">
                          {previewParams.length} parameters
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-background/60 border-border/30 rounded-xl border p-2.5">
                          <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                            Template Class
                          </div>
                          <div className="text-foreground mt-0.5 font-medium">
                            {templateData?.category || presetMatch?.category || "Factbook"}
                          </div>
                        </div>
                        <div className="bg-background/60 border-border/30 rounded-xl border p-2.5">
                          <div className="text-muted-foreground text-[10px] font-semibold uppercase">
                            Active Subtype
                          </div>
                          <div className="text-foreground mt-0.5 font-medium">
                            {activeVariant?.label || "Standard"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instant Wikitext Snippet */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                          Wikitext Invocation
                        </span>
                        <button
                          type="button"
                          data-cuelume-press="tap"
                          onClick={handleCopy}
                          className="text-wiki cursor-pointer text-[11px] transition-transform hover:underline active:scale-[0.98]"
                        >
                          {copied ? "Copied wikitext" : "Copy wikitext"}
                        </button>
                      </div>
                      <pre className="border-border/40 bg-background/90 text-foreground/90 max-h-72 overflow-y-auto rounded-2xl border p-3.5 font-mono text-[11px] leading-relaxed shadow-inner">
                        {sampleWikitext}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* ── View Mode: 2. Schema Parameters Matrix ── */}
              {viewMode === "schema" && (
                <div className="space-y-3">
                  <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Parameters ({paramEntries.length || previewParams.length})
                  </h3>

                  {previewParams.length === 0 ? (
                    <div className="text-muted-foreground py-12 text-center text-xs">
                      Standard template without explicit parameters.
                    </div>
                  ) : (
                    <div className="grid max-h-[460px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                      {previewParams.map((p) => (
                        <div
                          key={p.name}
                          className="border-border/40 bg-card/60 space-y-1 rounded-2xl border p-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-foreground font-mono text-xs font-bold">
                              {p.name}
                            </span>
                            {p.type && (
                              <Badge variant="secondary" className="text-[9px]">
                                {p.type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-[11px]">
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
                    <span className="text-muted-foreground text-xs font-bold">
                      Complete Wikitext Starter Code
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      Ready to paste into source editor
                    </span>
                  </div>
                  <pre className="border-border/40 bg-background/90 text-foreground/90 max-h-[460px] overflow-y-auto rounded-2xl border p-4 font-mono text-xs leading-relaxed shadow-inner">
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
