// src/components/wiki-os/editor/TemplatePaletteModal.tsx
// Interactive Template Palette, Parameter Form Builder & Live Preview Suite
"use client";

import * as React from "react";
import { ViewGrid, Search, Copy, Check, Plus, Spark, Xmark, NavArrowDown, Edit, Eye, List } from "iconoir-react";
import { api } from "~/trpc/react";
import { VisualInfoboxPreviewCard } from "~/components/wiki-os/templates/VisualInfoboxPreviewCard";
import {
  MASTER_TEMPLATE_PRESETS,
  type MasterTemplatePreset,
  type PaletteTemplateParam,
} from "~/lib/wiki-os/templates/master-presets";

// Re-exported for existing consumers (e.g. /util/templates page).
export { MASTER_TEMPLATE_PRESETS } from "~/lib/wiki-os/templates/master-presets";

export function TemplatePaletteModal({
  isOpen,
  onClose,
  onInsert,
}: TemplatePaletteModalProps) {
  const [mode, setMode] = React.useState<"canonical" | "all" | "builder">("canonical");
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<string>(MASTER_TEMPLATE_PRESETS[0]!.name);
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>("sovereign");
  const [modalViewMode, setModalViewMode] = React.useState<"form" | "visual">("form");
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [customParams, setCustomParams] = React.useState<Array<{ key: string; value: string }>>([]);
  const [newCustomKey, setNewCustomKey] = React.useState<string>("");
  const [newCustomVal, setNewCustomVal] = React.useState<string>("");
  const [copied, setCopied] = React.useState<boolean>(false);

  // Custom Builder State
  const [builderName, setBuilderName] = React.useState<string>("");
  const [builderCategory, setBuilderCategory] = React.useState<string>("sovereign");
  const [builderDescription, setBuilderDescription] = React.useState<string>("");
  const [builderParams, setBuilderParams] = React.useState<
    Array<{ name: string; label: string; type: string; example: string }>
  >([
    { name: "name", label: "Title / Name", type: "string", example: "Custom Entity" },
    { name: "image", label: "Vector Image", type: "wiki-file-name", example: "File:Example.svg" },
    { name: "category", label: "Classification", type: "string", example: "General" },
  ]);

  const saveCustomMutation = api.wikios.saveCustomTemplate.useMutation();

  // Dynamic search query when in "all" mode or typing a search query
  const { data: searchResults, refetch: refetchTemplates } = api.wikios.searchTemplates.useQuery(
    {
      query: searchQuery,
      category: activeCategory === "all" ? undefined : activeCategory,
      canonicalOnly: mode === "canonical",
      limit: 40,
    },
    { enabled: isOpen, staleTime: 30_000 }
  );

  // Dynamic template schema fetch
  const { data: dynamicSchema } = api.wikios.getTemplateData.useQuery(
    { title: selectedTemplateName },
    { enabled: isOpen && !MASTER_TEMPLATE_PRESETS.some((p) => p.name.toLowerCase() === selectedTemplateName.toLowerCase()), staleTime: 60_000 }
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

  const presetMatch = MASTER_TEMPLATE_PRESETS.find((t) => t.name.toLowerCase() === selectedTemplateName.toLowerCase());

  // Auto-switch variant when preset changes
  React.useEffect(() => {
    if (presetMatch?.variants && presetMatch.variants.length > 0) {
      setSelectedVariantId(presetMatch.variants[0]!.id);
    }
  }, [presetMatch]);

  const selectedTemplate = React.useMemo(() => {
    if (presetMatch) return presetMatch;

    const params: PaletteTemplateParam[] = [];
    const td = dynamicSchema?.templateData as any;
    if (td?.params) {
      for (const [key, p] of Object.entries(td.params) as Array<[string, any]>) {
        params.push({
          name: key,
          label: p.label || key,
          description: p.description,
          type: p.type || "string",
          required: !!p.required,
          example: p.example || p.default,
        });
      }
    }

    return {
      name: selectedTemplateName,
      category: (dynamicSchema?.category || "sovereign") as any,
      description: dynamicSchema?.description || "Registered realm template module.",
      isCanonical: !!dynamicSchema?.isCanonical,
      params: params.length > 0 ? params : [
        { name: "1", label: "Parameter 1", example: "Value" },
        { name: "2", label: "Parameter 2", example: "Value" },
      ],
    };
  }, [selectedTemplateName, presetMatch, dynamicSchema]);

  // Filter params based on active variant
  const activeParams = React.useMemo(() => {
    return selectedTemplate.params.filter((p) => {
      if (!p.variantOnly) return true;
      return p.variantOnly.includes(selectedVariantId);
    });
  }, [selectedTemplate, selectedVariantId]);

  // Visible templates list
  const visibleTemplates = React.useMemo(() => {
    if (mode === "canonical" && !searchQuery.trim()) {
      return MASTER_TEMPLATE_PRESETS.filter((t) => activeCategory === "all" || t.category === activeCategory);
    }

    if (searchResults?.templates && searchResults.templates.length > 0) {
      return searchResults.templates.map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description || (t.isCanonical ? "Canonical Master Schema" : "Registered Template"),
        isCanonical: t.isCanonical,
      }));
    }

    return MASTER_TEMPLATE_PRESETS.filter((t) => {
      const matchCat = activeCategory === "all" || t.category === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [mode, searchQuery, activeCategory, searchResults]);

  // Generate clean wikitext
  const generatedWikitext = React.useMemo(() => {
    const lines = [`{{${selectedTemplate.name}`];
    for (const param of activeParams) {
      const val = formValues[param.name] ?? param.example ?? "";
      lines.push(`| ${param.name.padEnd(20)} = ${val}`);
    }
    for (const cp of customParams) {
      if (cp.key.trim()) {
        lines.push(`| ${cp.key.trim().padEnd(20)} = ${cp.value}`);
      }
    }
    lines.push("}}");
    return lines.join("\n");
  }, [selectedTemplate, activeParams, formValues, customParams]);

  const handleParamChange = (paramName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleAddCustomParam = () => {
    if (!newCustomKey.trim()) return;
    setCustomParams((prev) => [...prev, { key: newCustomKey.trim(), value: newCustomVal }]);
    setNewCustomKey("");
    setNewCustomVal("");
  };

  const handleRemoveCustomParam = (index: number) => {
    setCustomParams((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateIntoBuilder = () => {
    setBuilderName(`${selectedTemplate.name} Custom`);
    setBuilderCategory(selectedTemplate.category);
    setBuilderDescription(`Custom variant of ${selectedTemplate.name}`);
    setBuilderParams(
      activeParams.map((p) => ({
        name: p.name,
        label: p.label || p.name,
        type: p.type || "string",
        example: p.example || "",
      }))
    );
    setMode("builder");
  };

  const handleSaveCustomTemplate = async () => {
    if (!builderName.trim()) return;
    try {
      await saveCustomMutation.mutateAsync({
        name: builderName.trim(),
        category: builderCategory,
        description: builderDescription,
        params: builderParams.map((p) => ({
          name: p.name.trim(),
          label: p.label.trim() || p.name.trim(),
          type: p.type,
          example: p.example,
          required: false,
        })),
      });
      await refetchTemplates();
      setSelectedTemplateName(builderName.trim());
      setMode("all");
    } catch (err) {
      console.error("Failed to save custom template:", err);
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(generatedWikitext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsert) {
      const merged = { ...formValues };
      for (const cp of customParams) {
        if (cp.key.trim()) merged[cp.key.trim()] = cp.value;
      }
      onInsert(generatedWikitext, merged);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-160">
      <div className="flex h-[88vh] max-h-[880px] w-full max-w-5xl flex-col rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-secondary/15">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-wiki/15 text-wiki shadow-inner">
              <ViewGrid className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">Master Template Palette & Custom Builder</h3>
              <p className="text-[11px] text-muted-foreground">
                Polymorphic realm factbooks, dynamic variant switchers, live engine connectors, and custom designers
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-2xl border border-border/40 bg-secondary/40 p-1">
            <button
              type="button"
              onClick={() => setMode("canonical")}
              className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
                mode === "canonical"
                  ? "bg-wiki text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ✨ Master Suites
            </button>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
                mode === "all"
                  ? "bg-wiki text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🌐 All Templates
            </button>
            <button
              type="button"
              onClick={() => setMode("builder")}
              className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
                mode === "builder"
                  ? "bg-wiki text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🛠️ Custom Builder
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-[0.98] transition-colors"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        {/* Builder Mode View */}
        {mode === "builder" ? (
          <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h4 className="text-base font-bold text-foreground">Custom Infobox & Template Designer</h4>
                <p className="text-xs text-muted-foreground">
                  Create, configure, and register a new reusable template for your realm.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCustomTemplate}
                disabled={saveCustomMutation.isPending || !builderName.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-wiki px-4 py-2 text-xs font-bold text-black shadow-lg hover:bg-wiki/90 active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {saveCustomMutation.isPending ? "Saving to Registry…" : "Save & Register Template"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Template Name</label>
                <input
                  type="text"
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="e.g. Infobox Space Station"
                  className="h-9 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Category Domain</label>
                <select
                  value={builderCategory}
                  onChange={(e) => setBuilderCategory(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                >
                  <option value="sovereign">🏛️ Sovereign & Lands</option>
                  <option value="biography">👤 Biographies & Leaders</option>
                  <option value="defense">⚔️ Defense & Fleet</option>
                  <option value="economy">🏢 Enterprise & Infrastructure</option>
                  <option value="lore">🔬 Science, Faith & Culture</option>
                  <option value="formatting">📜 Layout & Citations</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Description</label>
                <input
                  type="text"
                  value={builderDescription}
                  onChange={(e) => setBuilderDescription(e.target.value)}
                  placeholder="Brief description of this template"
                  className="h-9 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Parameter Fields Designer */}
            <div className="space-y-3 rounded-2xl border border-border/40 bg-secondary/20 p-5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-foreground">Template Parameters ({builderParams.length})</h5>
                <button
                  type="button"
                  onClick={() =>
                    setBuilderParams((prev) => [
                      ...prev,
                      { name: `param_${prev.length + 1}`, label: `Field ${prev.length + 1}`, type: "string", example: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs text-wiki font-semibold hover:underline active:scale-[0.98]"
                >
                  <Plus className="h-3 w-3" /> Add Parameter Field
                </button>
              </div>

              <div className="space-y-2">
                {builderParams.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-background/80 p-2.5 border border-border/30 shadow-sm">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                        )
                      }
                      placeholder="Key (e.g. population)"
                      className="h-7 w-1/4 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground font-mono"
                    />
                    <input
                      type="text"
                      value={p.label}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                        )
                      }
                      placeholder="Display Label"
                      className="h-7 w-1/4 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
                    />
                    <select
                      value={p.type}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, type: e.target.value } : item))
                        )
                      }
                      className="h-7 w-1/4 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
                    >
                      <option value="string">Text String</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="currency">Currency</option>
                      <option value="wiki-page-name">Wiki Page Link</option>
                      <option value="wiki-file-name">Image File Link</option>
                      <option value="coordinates">Coordinates (GIS)</option>
                    </select>
                    <input
                      type="text"
                      value={p.example}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, example: e.target.value } : item))
                        )
                      }
                      placeholder="Example Value"
                      className="h-7 w-1/4 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setBuilderParams((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-muted-foreground hover:text-red-400 active:scale-[0.98]"
                    >
                      <Xmark className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Standard View (2-Column Split Layout) */
          <div className="grid flex-1 grid-cols-1 divide-y divide-border/40 overflow-hidden md:grid-cols-12 md:divide-x md:divide-y-0">
            {/* Left Column: Template Selector (4 cols) */}
            <div className="flex flex-col md:col-span-4 p-4 space-y-3 overflow-y-auto bg-secondary/10">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={mode === "canonical" ? "Filter master suites…" : "Search curated templates…"}
                  className="h-8 w-full rounded-xl border border-border/40 bg-background/60 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-wiki/60 focus:outline-none"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium active:scale-[0.98] transition-all ${
                      activeCategory === c.id
                        ? "bg-wiki/20 text-wiki font-semibold shadow-xs"
                        : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Template List */}
              <div className="space-y-1 pt-1 flex-1">
                {visibleTemplates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateName(t.name);
                      setFormValues({});
                      setCustomParams([]);
                    }}
                    className={`flex w-full flex-col rounded-xl p-3 text-left active:scale-[0.98] transition-all ${
                      selectedTemplateName.toLowerCase() === t.name.toLowerCase()
                        ? "bg-wiki/15 border border-wiki/30 shadow-sm"
                        : "hover:bg-secondary/40 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{t.name}</span>
                      {t.isCanonical && (
                        <span className="rounded-md bg-wiki/20 px-1.5 py-0.5 text-[9px] font-bold text-wiki uppercase tracking-wider">
                          Master
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Parameter Form, Dynamic Variants & Live Preview (8 cols) */}
            <div className="flex flex-col md:col-span-8 overflow-y-auto p-6 space-y-5">
              {/* Template Header Info */}
              <div className="flex items-start justify-between border-b border-border/40 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">{selectedTemplate.name}</h4>
                    <span className="rounded-full bg-wiki/15 px-2.5 py-0.5 text-[10px] font-semibold text-wiki uppercase">
                      {selectedTemplate.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-border/40 bg-secondary/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setModalViewMode("form")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
                        modalViewMode === "form" ? "bg-wiki text-black shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <List className="h-3 w-3" /> Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalViewMode("visual")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
                        modalViewMode === "visual" ? "bg-wiki text-black shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3 w-3" /> Visual Preview
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleDuplicateIntoBuilder}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.98] transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5 text-wiki" /> Duplicate & Customize
                  </button>
                </div>
              </div>

              {/* Dynamic Variant Switcher Pill Bar (if master template has variants) */}
              {presetMatch?.variants && presetMatch.variants.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-border/40 bg-secondary/25 p-3.5">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    Template Variant / Subtype
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {presetMatch.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`rounded-xl px-3 py-1 text-xs font-semibold active:scale-[0.98] transition-all ${
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

              {modalViewMode === "visual" ? (
                <div className="flex justify-center py-2">
                  <VisualInfoboxPreviewCard
                    templateName={selectedTemplate.name}
                    variantId={selectedVariantId}
                    variantLabel={presetMatch?.variants?.find((v) => v.id === selectedVariantId)?.label}
                    category={selectedTemplate.category}
                    params={activeParams}
                    customValues={formValues}
                  />
                </div>
              ) : (
                /* Parameter Inputs Grid */
                <div className="space-y-3 rounded-2xl border border-border/40 bg-secondary/20 p-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-foreground">Configure Fields ({activeParams.length})</h5>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {activeParams.map((p) => (
                    <div key={p.name} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-medium text-foreground">
                        <span>{p.label || p.name}</span>
                        {p.required && <span className="text-amber-400 font-bold">*</span>}
                      </label>
                      <input
                        type="text"
                        value={formValues[p.name] ?? ""}
                        onChange={(e) => handleParamChange(p.name, e.target.value)}
                        placeholder={p.example || `Enter ${p.name}…`}
                        className="h-8 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none font-sans"
                      />
                    </div>
                  ))}

                  {/* Custom Parameter Fields */}
                  {customParams.map((cp, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-medium text-wiki">
                        <span>{cp.key} (Custom)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomParam(idx)}
                          className="text-muted-foreground hover:text-red-400 active:scale-[0.98]"
                        >
                          <Xmark className="h-3 w-3" />
                        </button>
                      </label>
                      <input
                        type="text"
                        value={cp.value}
                        onChange={(e) =>
                          setCustomParams((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item))
                          )
                        }
                        className="h-8 w-full rounded-xl border border-wiki/40 bg-background px-3 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Add Custom Field Inline */}
                <div className="pt-3 border-t border-border/30 flex items-center gap-2">
                  <input
                    type="text"
                    value={newCustomKey}
                    onChange={(e) => setNewCustomKey(e.target.value)}
                    placeholder="+ Add custom field key (e.g. founder)"
                    className="h-7.5 flex-1 rounded-lg border border-border/30 bg-background/80 px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newCustomVal}
                    onChange={(e) => setNewCustomVal(e.target.value)}
                    placeholder="Value"
                    className="h-7.5 flex-1 rounded-lg border border-border/30 bg-background/80 px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomParam}
                    disabled={!newCustomKey.trim()}
                    className="rounded-lg bg-secondary/80 px-3.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.98] disabled:opacity-50 transition-colors"
                  >
                    Add Field
                  </button>
                </div>
              </div>
              )}

              {/* Live Wikitext Output */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">Live Generated Wikitext</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-wiki hover:underline active:scale-[0.98]"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
                <pre className="max-h-44 overflow-y-auto rounded-xl border border-border/40 bg-background/90 p-3 font-mono text-[11px] text-foreground/90 leading-relaxed shadow-inner">
                  {generatedWikitext}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 bg-secondary/30 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/40 bg-secondary/60 px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.98] transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/80 px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.98] transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied to Clipboard" : "Copy Wikitext"}
            </button>

            {onInsert && (
              <button
                type="button"
                onClick={handleInsert}
                className="inline-flex items-center gap-1.5 rounded-xl bg-wiki px-4 py-1.5 text-xs font-bold text-black shadow-lg hover:bg-wiki/90 active:scale-[0.98] transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert into Canvas
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
