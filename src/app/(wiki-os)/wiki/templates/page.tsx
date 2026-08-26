// src/app/(wiki-os)/wiki/templates/page.tsx
// WikiOS Template Registry & Custom Infobox Palette
"use client";

import React, { useState } from "react";
import { ViewGrid, Search, Code, Check, Sparks as Sparkles, OpenBook as BookOpen, Packages as Layers } from "iconoir-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Badge } from "~/components/ui/badge";

export default function WikiTemplatesPage() {
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: searchResults, isLoading } = api.wikios.searchTemplates.useQuery({
    query: search,
    limit: 40,
  });

  const { data: templateData } = api.wikios.getTemplateData.useQuery(
    { title: selectedTemplate! },
    { enabled: !!selectedTemplate }
  );

  return (
    <WikiOSLayout title="Template Registry & Infobox Palette">
      <div className="w-full max-w-6xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ViewGrid className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Template Registry & Infobox Designer</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect canonical TemplateData schemas, infobox parameters, and scoped styles.
              </p>
            </div>
          </div>

          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search canonical templates (e.g. Infobox, Country, Flag)..."
              className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 shadow-inner"
            />
          </div>
        </div>

        {/* Template List & Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Template Catalog */}
          <div className="md:col-span-1 rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur-xl h-[600px] overflow-y-auto space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
              Available Templates ({searchResults?.templates?.length ?? 0})
            </div>
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading templates...</div>
            ) : searchResults?.templates && searchResults.templates.length > 0 ? (
              searchResults.templates.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl.name)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                    selectedTemplate === tmpl.name
                      ? "bg-purple-500/15 border border-purple-500/30 text-purple-400 font-semibold"
                      : "hover:bg-muted/60 text-foreground border border-transparent"
                  }`}
                >
                  <span className="truncate">{tmpl.name}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0 ml-1">
                    {tmpl.category || "Template"}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">No templates found.</div>
            )}
          </div>

          {/* Right Column: Template Inspector */}
          <div className="md:col-span-2 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl min-h-[600px]">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedTemplate}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {templateData?.description || (templateData?.templateData as any)?.description || "Canonical WikiOS Schema & Component"}
                    </p>
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    TemplateData Active
                  </Badge>
                </div>

                {(() => {
                  const rawParams = (templateData?.templateData as any)?.params || (templateData as any)?.params || {};
                  const paramEntries = Object.entries(rawParams);

                  if (paramEntries.length === 0) {
                    return (
                      <div className="py-16 text-center text-xs text-muted-foreground">
                        Standard template without explicit TemplateData schema.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Parameters ({paramEntries.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {paramEntries.map(([paramName, paramInfo]: [string, any]) => (
                          <div
                            key={paramName}
                            className="p-3 rounded-xl border border-border/40 bg-card/60 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-foreground">
                                {paramName}
                              </span>
                              {paramInfo?.required && (
                                <span className="text-[9px] text-red-400 font-bold uppercase">Required</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {paramInfo?.description || paramInfo?.label || "Parameter value"}
                            </p>
                            {paramInfo?.type && (
                              <Badge variant="secondary" className="text-[9px]">
                                {paramInfo.type}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-center text-muted-foreground space-y-2">
                <Code className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">Select a template to inspect its schema and parameters</p>
                <p className="text-xs max-w-sm text-muted-foreground/80">
                  WikiOS parses canonical infobox schemas, param descriptions, and validation rules in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </WikiOSLayout>
  );
}
