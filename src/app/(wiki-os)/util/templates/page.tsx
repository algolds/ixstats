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

  const rawParams = (templateData?.templateData as any)?.params || (templateData as any)?.params || {};
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
      <div className="w-full max-w-7xl mx-auto space-y-6 pb-16">
        {/* Header Banner */}
        <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-wiki/15 text-wiki border border-wiki/20 shadow-inner">
                <ViewGrid className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Template Registry & Infobox Suite</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unified polymorphic realm factbooks, dynamic variant schemas, and live simulation data connectors
                </p>
              </div>
            </div>

            <Badge variant="outline" className="flex items-center gap-1.5 bg-wiki/10 text-wiki border-wiki/30 text-xs px-3 py-1.5 w-fit">
              <Spark className="h-3.5 w-3.5" /> Polymorphic Engine & Visual Factbook
            </Badge>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mt-5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates (e.g. Country, Ship, Person, Citation)..."
                className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-10 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-wiki focus:outline-none shadow-inner"
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
                  className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${
                    activeCategory === c.id
                      ? "bg-wiki/20 text-wiki font-bold shadow-xs border border-wiki/30"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Template Catalog (4 cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-border/60 bg-card/40 p-4 backdrop-blur-xl h-[720px] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
              <span>Curated Templates ({searchResults?.templates?.length ?? 0})</span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading template registry...</div>
            ) : searchResults?.templates && searchResults.templates.length > 0 ? (
              searchResults.templates.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  data-cuelume-press="soft"
                  data-cuelume-hover="tick"
                  onClick={() => setSelectedTemplateName(tmpl.name)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs transition-all flex flex-col gap-1 cursor-pointer active:scale-[0.98] ${
                    selectedTemplateName.toLowerCase() === tmpl.name.toLowerCase()
                      ? "bg-wiki/15 border border-wiki/30 text-foreground font-semibold shadow-sm"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-foreground truncate">{tmpl.name}</span>
                    {tmpl.isCanonical && (
                      <span className="rounded-md bg-wiki/20 px-1.5 py-0.5 text-[9px] font-bold text-wiki uppercase tracking-wider">
                        Master
                      </span>
                    )}
                  </div>
                  {tmpl.description && (
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {tmpl.description}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">No templates match query.</div>
            )}
          </div>

          {/* Right Column: Template Inspector & Visual Preview (8 cols) */}
          <div className="lg:col-span-8 rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl min-h-[720px] flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Title & View Switcher Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selectedTemplateName}</h2>
                    <span className="rounded-full bg-wiki/15 px-2.5 py-0.5 text-[10px] font-semibold text-wiki uppercase">
                      {templateData?.category || "Template"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {templateData?.description || "Canonical WikiOS Schema & Component"}
                  </p>
                </div>

                {/* View Mode Segmented Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-border/60 bg-secondary/50 p-1 shadow-inner">
                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("visual")}
                      className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${
                        viewMode === "visual" ? "text-black font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "visual" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="absolute inset-0 -z-10 rounded-lg bg-wiki shadow-xs"
                        />
                      )}
                      <Eye className="h-3.5 w-3.5" />
                      <span>Visual Preview</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("schema")}
                      className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${
                        viewMode === "schema" ? "text-black font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "schema" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="absolute inset-0 -z-10 rounded-lg bg-wiki shadow-xs"
                        />
                      )}
                      <List className="h-3.5 w-3.5" />
                      <span>Parameters</span>
                    </button>

                    <button
                      type="button"
                      data-cuelume-press="tap"
                      onClick={() => setViewMode("wikitext")}
                      className={`relative z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${
                        viewMode === "wikitext" ? "text-black font-bold shadow-xs" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {viewMode === "wikitext" && (
                        <motion.div
                          layoutId="activeInspectorView"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                          className="absolute inset-0 -z-10 rounded-lg bg-wiki shadow-xs"
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-wiki" />}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Variant Switcher Pill Bar */}
              {presetMatch?.variants && presetMatch.variants.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-border/40 bg-secondary/25 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Polymorphic Variant / Subtype
                    </span>
                    <span className="text-[10px] text-muted-foreground">
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
                        className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer ${
                          selectedVariantId === v.id
                            ? "bg-wiki text-black shadow-md font-bold"
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
                <div className="flex flex-col xl:flex-row items-start justify-center gap-6 py-2">
                  <div className="mx-auto xl:mx-0 shrink-0">
                    <VisualInfoboxPreviewCard
                      templateName={selectedTemplateName}
                      variantId={selectedVariantId}
                      variantLabel={activeVariant?.label}
                      category={templateData?.category || presetMatch?.category}
                      params={previewParams}
                    />
                  </div>

                  <div className="flex-1 space-y-4 w-full">
                    {/* Live Schema Metadata Card */}
                    <div className="rounded-2xl border border-border/40 bg-secondary/15 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Factbook Specification
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono border-border/60">
                          {previewParams.length} parameters
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Template Class</div>
                          <div className="font-medium text-foreground mt-0.5">{templateData?.category || presetMatch?.category || "Factbook"}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">Active Subtype</div>
                          <div className="font-medium text-foreground mt-0.5">{activeVariant?.label || "Standard"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Instant Wikitext Snippet */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Wikitext Invocation
                        </span>
                        <button
                          type="button"
                          data-cuelume-press="tap"
                          onClick={handleCopy}
                          className="text-[11px] text-wiki hover:underline active:scale-[0.98] transition-transform cursor-pointer"
                        >
                          {copied ? "Copied wikitext" : "Copy wikitext"}
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-y-auto rounded-2xl border border-border/40 bg-background/90 p-3.5 font-mono text-[11px] text-foreground/90 leading-relaxed shadow-inner">
                        {sampleWikitext}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* ── View Mode: 2. Schema Parameters Matrix ── */}
              {viewMode === "schema" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Parameters ({paramEntries.length || previewParams.length})
                  </h3>

                  {previewParams.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      Standard template without explicit parameters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                      {previewParams.map((p) => (
                        <div
                          key={p.name}
                          className="p-3 rounded-2xl border border-border/40 bg-card/60 space-y-1 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-foreground">
                              {p.name}
                            </span>
                            {p.type && (
                              <Badge variant="secondary" className="text-[9px]">
                                {p.type}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
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
                    <span className="text-xs font-bold text-muted-foreground">Complete Wikitext Starter Code</span>
                    <span className="text-[10px] text-muted-foreground">Ready to paste into source editor</span>
                  </div>
                  <pre className="max-h-[460px] overflow-y-auto rounded-2xl border border-border/40 bg-background/90 p-4 font-mono text-xs text-foreground/90 leading-relaxed shadow-inner">
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
