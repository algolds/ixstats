// src/components/wiki-os/editor/TemplatePaletteModal.tsx
// Interactive Template Palette, Parameter Form Builder & Live Preview Suite
"use client";

import * as React from "react";
import { ViewGrid, Search, Copy, Check, Plus, Spark, Xmark } from "iconoir-react";
import { api } from "~/trpc/react";

interface TemplatePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (wikitext: string, data: Record<string, string>) => void;
}

interface TemplateParam {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  default?: string;
  example?: string;
}

const TEMPLATE_PRESETS: Array<{
  name: string;
  category: string;
  description: string;
  isCanonical?: boolean;
  params: TemplateParam[];
}> = [
  {
    name: "Infobox Sovereign State",
    category: "infobox",
    description: "Official sovereign nation, empire, confederation, or realm factbook.",
    isCanonical: true,
    params: [
      { name: "common_name", label: "Common Name", required: true, example: "Burgundie" },
      { name: "official_name", label: "Official Name", example: "Grand Republic of Burgundie" },
      { name: "capital", label: "Capital City", required: true, example: "Vilena" },
      { name: "leader_title1", label: "Leader Title", example: "President" },
      { name: "leader_name1", label: "Leader Name", example: "Jean Dupont" },
      { name: "population", label: "Population", example: "45,200,000" },
      { name: "gdp_nominal", label: "Nominal GDP", example: "$1.82 Trillion" },
      { name: "currency", label: "Currency", example: "Burgundian Franc (BGF)" },
      { name: "flag_image", label: "Flag Image", example: "File:Flag_of_Burgundie.svg" },
      { name: "motto", label: "National Motto", example: "Liberté, Ordre, Concorde" },
    ],
  },
  {
    name: "Infobox Settlement",
    category: "infobox",
    description: "City, municipality, town, province, or geographic district factbook.",
    isCanonical: true,
    params: [
      { name: "name", label: "Settlement Name", required: true, example: "Vilena" },
      { name: "settlement_type", label: "Type", example: "Capital City & Municipality" },
      { name: "subdivision_name", label: "Country", required: true, example: "Burgundie" },
      { name: "leader_title", label: "Mayor / Governor", example: "Mayor" },
      { name: "leader_name", label: "Leader Name", example: "Clara Vane" },
      { name: "population_total", label: "Total Population", example: "3,420,000" },
      { name: "area_km2", label: "Total Area (km²)", example: "582" },
      { name: "image_skyline", label: "Skyline Image", example: "File:Vilena_Skyline.jpg" },
    ],
  },
  {
    name: "Infobox Person",
    category: "infobox",
    description: "Head of state, diplomat, commander, or notable historical figure.",
    isCanonical: true,
    params: [
      { name: "name", label: "Full Name", required: true, example: "Arthur Vance" },
      { name: "office", label: "Primary Office", example: "High Chancellor of Vesper" },
      { name: "term_start", label: "Term Start", example: "2020" },
      { name: "term_end", label: "Term End", example: "Present" },
      { name: "birth_date", label: "Birth Date", example: "14 May 1968" },
      { name: "nationality", label: "Nationality", example: "Vesperian" },
      { name: "political_party", label: "Party", example: "Concord Party" },
      { name: "image", label: "Portrait", example: "File:Arthur_Vance_Portrait.jpg" },
    ],
  },
  {
    name: "Infobox Naval Vessel",
    category: "military",
    description: "Warship, submarine, auxiliary vessel, or commercial fleet flagship.",
    isCanonical: true,
    params: [
      { name: "ship_name", label: "Ship Name & Hull No.", required: true, example: "BNS Vilena (BB-04)" },
      { name: "ship_class", label: "Class", example: "Vilena-class Battleship" },
      { name: "operator", label: "Operating Navy", required: true, example: "Royal Burgundian Navy" },
      { name: "commissioned", label: "Commissioned Date", example: "1938" },
      { name: "displacement_tons", label: "Displacement", example: "45,000 tonnes" },
      { name: "armament", label: "Primary Armament", example: "9 × 406mm Guns" },
      { name: "ship_image", label: "Vessel Image", example: "File:BNS_Vilena.jpg" },
    ],
  },
  {
    name: "Infobox Enterprise",
    category: "infobox",
    description: "Commercial corporation, state-owned enterprise, conglomerate, or bank.",
    isCanonical: true,
    params: [
      { name: "name", label: "Company Name", required: true, example: "Solcordia Energy Corp" },
      { name: "industry", label: "Primary Industry", required: true, example: "Energy & Infrastructure" },
      { name: "headquarters", label: "Headquarters", required: true, example: "Vilena, Burgundie" },
      { name: "key_people", label: "Key Executives", example: "Marcus Sterling (CEO)" },
      { name: "revenue", label: "Annual Revenue", example: "$42.5 Billion (2025)" },
      { name: "employees", label: "Total Employees", example: "84,000" },
      { name: "logo", label: "Logo Image", example: "File:Solcordia_Logo.svg" },
    ],
  },
  {
    name: "Infobox Military Conflict",
    category: "military",
    description: "War, military campaign, tactical battle, siege, or border skirmish.",
    isCanonical: true,
    params: [
      { name: "conflict", label: "Conflict Name", required: true, example: "The Sand War" },
      { name: "date", label: "Date / Duration", required: true, example: "14 June 1984 – 3 August 1986" },
      { name: "place", label: "Location", required: true, example: "Northern Oakhaven Basin" },
      { name: "result", label: "Outcome / Result", required: true, example: "Decisive Burgundian Victory" },
      { name: "combatant1", label: "Combatants (Side A)", example: "Burgundie & Vesper Alliance" },
      { name: "combatant2", label: "Combatants (Side B)", example: "Paulastran Cyber Corps" },
      { name: "commanders1", label: "Commanders (Side A)", example: "Gen. Arthur Vance" },
      { name: "commanders2", label: "Commanders (Side B)", example: "Marshal Kirov" },
    ],
  },
  {
    name: "Infobox Government Agency",
    category: "infobox",
    description: "Ministry, department, intelligence bureau, supreme court, or parliament.",
    isCanonical: true,
    params: [
      { name: "agency_name", label: "Agency Name", required: true, example: "Ministry of Foreign Affairs" },
      { name: "abbreviation", label: "Abbreviation", example: "MFA" },
      { name: "jurisdiction", label: "Jurisdiction", required: true, example: "Burgundie" },
      { name: "minister", label: "Executive Minister", example: "Minister Jean Dupont" },
      { name: "headquarters", label: "Headquarters", example: "Palais Vilena, Vilena" },
      { name: "budget", label: "Annual Budget", example: "$12.4 Billion" },
    ],
  },
  {
    name: "Infobox Military Unit",
    category: "military",
    description: "Army brigade, armored division, air force squadron, or special forces group.",
    isCanonical: true,
    params: [
      { name: "unit_name", label: "Unit Designation", required: true, example: "1st Royal Armored Division" },
      { name: "country", label: "Allegiance", required: true, example: "Burgundie" },
      { name: "branch", label: "Service Branch", required: true, example: "Royal Army" },
      { name: "active_dates", label: "Active Period", example: "1924–present" },
      { name: "commanding_officer", label: "Commander", example: "Maj. Gen. Thomas Drake" },
      { name: "garrison", label: "Home Garrison", example: "Fort Oakhaven" },
    ],
  },
  {
    name: "Infobox Political Party",
    category: "infobox",
    description: "Political party, parliamentary faction, or electoral alliance.",
    isCanonical: true,
    params: [
      { name: "party_name", label: "Party Name", required: true, example: "Concord Party" },
      { name: "leader", label: "Party Leader", example: "Chancellor Elspeth Kane" },
      { name: "ideology", label: "Political Ideology", required: true, example: "Liberal Democracy, Free Market" },
      { name: "seats_parliament", label: "Parliamentary Seats", example: "142 / 300 Seats (Majority)" },
      { name: "headquarters", label: "Headquarters", example: "Vilena" },
    ],
  },
  {
    name: "Infobox Weapon & Equipment",
    category: "military",
    description: "Firearm, artillery piece, main battle tank, fighter aircraft, or equipment.",
    isCanonical: true,
    params: [
      { name: "name", label: "Weapon Name", required: true, example: "MAG-17 Battle Rifle" },
      { name: "origin", label: "Country of Origin", required: true, example: "Burgundie" },
      { name: "caliber", label: "Caliber / Cartridge", example: "7.62 × 51mm" },
      { name: "effective_range", label: "Effective Range", example: "600 m" },
      { name: "designer", label: "Manufacturer", example: "Vilena Armory" },
    ],
  },
  {
    name: "Hatnote Capsule",
    category: "formatting",
    description: "Article disambiguation notice, main article reference, or redirect banner.",
    isCanonical: true,
    params: [
      { name: "text", label: "Notice Text", required: true, example: "This article is about the sovereign state. For the capital, see [[Vilena]]." },
      { name: "type", label: "Hatnote Type", example: "disambiguation | redirect | main | see_also" },
    ],
  },
  {
    name: "Quote Box",
    category: "formatting",
    description: "Highlighted speech excerpt, lore document citation, or quotation capsule.",
    isCanonical: true,
    params: [
      { name: "quote", label: "Quote Text", required: true, example: "Freedom is won in the assembly and held on the border." },
      { name: "author", label: "Speaker / Author", required: true, example: "Chancellor Elspeth Kane" },
      { name: "source", label: "Source / Speech", example: "Address to the Continental Senate, 2021" },
    ],
  },
  {
    name: "Dynamic Navbox Deck",
    category: "formatting",
    description: "Structured series footer, national ministry index, or topic navigation table.",
    isCanonical: true,
    params: [
      { name: "title", label: "Navbox Header Title", required: true, example: "Provinces & Territories of Burgundie" },
      { name: "group1", label: "Group 1 Name", example: "Core Provinces" },
      { name: "list1", label: "Articles in Group 1", example: "[[Vilena]] • [[Oakhaven]] • [[Sudmoll]]" },
      { name: "group2", label: "Group 2 Name", example: "Autonomous Regions" },
      { name: "list2", label: "Articles in Group 2", example: "[[Vonein Basin]] • [[Seneca Islands]]" },
    ],
  },
  {
    name: "Citation Reference",
    category: "formatting",
    description: "Standardized scholarly footnote, archive citation, or external reference link.",
    isCanonical: true,
    params: [
      { name: "title", label: "Source Article / Book Title", required: true, example: "Constitutional History of Burgundie" },
      { name: "author", label: "Author", example: "Dr. Henri Dubois" },
      { name: "year", label: "Year / Date", example: "2018" },
      { name: "publisher", label: "Publisher / Journal", example: "Vilena University Press" },
      { name: "url", label: "External URL Link", example: "https://archives.ixwiki.com/doc/142" },
    ],
  },
];

export function TemplatePaletteModal({
  isOpen,
  onClose,
  onInsert,
}: TemplatePaletteModalProps) {
  const [mode, setMode] = React.useState<"canonical" | "all" | "builder">("canonical");
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedTemplateName, setSelectedTemplateName] = React.useState<string>(TEMPLATE_PRESETS[0]!.name);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [customParams, setCustomParams] = React.useState<Array<{ key: string; value: string }>>([]);
  const [newCustomKey, setNewCustomKey] = React.useState<string>("");
  const [newCustomVal, setNewCustomVal] = React.useState<string>("");
  const [copied, setCopied] = React.useState<boolean>(false);

  // Custom Template Builder State
  const [builderName, setBuilderName] = React.useState<string>("");
  const [builderCategory, setBuilderCategory] = React.useState<string>("infobox");
  const [builderDescription, setBuilderDescription] = React.useState<string>("");
  const [builderParams, setBuilderParams] = React.useState<
    Array<{ name: string; label: string; type: string; example: string }>
  >([
    { name: "name", label: "Title / Name", type: "string", example: "Custom Name" },
    { name: "image", label: "Image", type: "wiki-file-name", example: "File:Example.jpg" },
    { name: "category", label: "Type / Category", type: "string", example: "General" },
  ]);

  const saveCustomMutation = api.wikios.saveCustomTemplate.useMutation();

  // Dynamic search query when in "all" mode or typing a search query
  const { data: searchResults, refetch: refetchTemplates } = api.wikios.searchTemplates.useQuery(
    {
      query: searchQuery,
      category: activeCategory === "all" ? undefined : activeCategory,
      canonicalOnly: mode === "canonical",
      limit: 35,
    },
    { enabled: isOpen, staleTime: 30_000 }
  );

  // Dynamic template schema fetch for templates not in static presets
  const { data: dynamicSchema } = api.wikios.getTemplateData.useQuery(
    { title: selectedTemplateName },
    { enabled: isOpen && !TEMPLATE_PRESETS.some((p) => p.name === selectedTemplateName), staleTime: 60_000 }
  );

  const categories = [
    { id: "all", label: "All Types" },
    { id: "infobox", label: "Infoboxes" },
    { id: "military", label: "Military & Security" },
    { id: "formatting", label: "Formatting & Quotes" },
  ];

  const presetMatch = TEMPLATE_PRESETS.find((t) => t.name === selectedTemplateName);

  const selectedTemplate = React.useMemo(() => {
    if (presetMatch) return presetMatch;

    // Build dynamic template object from backend schema
    const params: TemplateParam[] = [];
    const td = dynamicSchema?.templateData as any;
    if (td?.params) {
      for (const [key, p] of Object.entries(td.params) as Array<[string, any]>) {
        params.push({
          name: key,
          label: p.label || key,
          description: p.description,
          required: !!p.required,
          example: p.example || p.default,
        });
      }
    }

    return {
      name: selectedTemplateName,
      category: dynamicSchema?.category || "general",
      description: dynamicSchema?.description || "Realm lore template module.",
      isCanonical: false,
      params: params.length > 0 ? params : [
        { name: "1", label: "Parameter 1", example: "Value" },
        { name: "2", label: "Parameter 2", example: "Value" },
      ],
    };
  }, [selectedTemplateName, presetMatch, dynamicSchema]);

  // Combined template list based on mode & search
  const visibleTemplates = React.useMemo(() => {
    if (mode === "canonical" && !searchQuery.trim()) {
      return TEMPLATE_PRESETS.filter((t) => activeCategory === "all" || t.category === activeCategory);
    }

    if (searchResults?.templates && searchResults.templates.length > 0) {
      return searchResults.templates.map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description || (t.isCanonical ? "Canonical WikiOS Schema" : "Registered Template"),
        isCanonical: t.isCanonical,
      }));
    }

    return TEMPLATE_PRESETS.filter((t) => {
      const matchCat = activeCategory === "all" || t.category === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [mode, searchQuery, activeCategory, searchResults]);

  // Generate wikitext from current form values + custom fields
  const generatedWikitext = React.useMemo(() => {
    const lines = [`{{${selectedTemplate.name}`];
    for (const param of selectedTemplate.params) {
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
  }, [selectedTemplate, formValues, customParams]);

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
      selectedTemplate.params.map((p) => ({
        name: p.name,
        label: p.label || p.name,
        type: "string",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-160">
      <div className="flex h-[85vh] max-h-[850px] w-full max-w-4xl flex-col rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-wiki/15 text-wiki">
              <ViewGrid className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Template Palette & Inspector</h3>
              <p className="text-[11px] text-muted-foreground">
                Configure, build, and insert structured realm lore infoboxes and custom modules
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-secondary/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("canonical")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                mode === "canonical"
                  ? "bg-wiki text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ✨ Canonical Suite
            </button>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
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
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                mode === "builder"
                  ? "bg-wiki text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🛠️ Build Custom Infobox
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
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
                  Build and register a brand new reusable template for your realm.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCustomTemplate}
                disabled={saveCustomMutation.isPending || !builderName.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-wiki px-4 py-2 text-xs font-bold text-black shadow-lg hover:bg-wiki/90 disabled:opacity-50 transition-all"
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
                  className="h-8 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Category</label>
                <select
                  value={builderCategory}
                  onChange={(e) => setBuilderCategory(e.target.value)}
                  className="h-8 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground focus:border-wiki/60 focus:outline-none"
                >
                  <option value="infobox">Infobox</option>
                  <option value="military">Military & Defense</option>
                  <option value="formatting">Formatting & Quotes</option>
                  <option value="navigation">Navigation & Series</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Description</label>
                <input
                  type="text"
                  value={builderDescription}
                  onChange={(e) => setBuilderDescription(e.target.value)}
                  placeholder="Brief description of this template"
                  className="h-8 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Parameter Fields Designer */}
            <div className="space-y-3 rounded-2xl border border-border/40 bg-secondary/20 p-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-foreground">Template Parameters ({builderParams.length})</h5>
                <button
                  type="button"
                  onClick={() =>
                    setBuilderParams((prev) => [
                      ...prev,
                      { name: `param_${prev.length + 1}`, label: `Field ${prev.length + 1}`, type: "string", example: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs text-wiki font-semibold hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Parameter Field
                </button>
              </div>

              <div className="space-y-2">
                {builderParams.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl bg-background/60 p-2 border border-border/30">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                        )
                      }
                      placeholder="Param Key (e.g. population)"
                      className="h-7 w-1/3 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
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
                      className="h-7 w-1/3 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
                    />
                    <input
                      type="text"
                      value={p.example}
                      onChange={(e) =>
                        setBuilderParams((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, example: e.target.value } : item))
                        )
                      }
                      placeholder="Example Value"
                      className="h-7 w-1/3 rounded-lg border border-border/30 bg-background px-2 text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setBuilderParams((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-muted-foreground hover:text-red-400"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Standard View (2-Column Grid) */
          <div className="grid flex-1 grid-cols-1 divide-y divide-border/40 overflow-hidden md:grid-cols-12 md:divide-x md:divide-y-0">
            {/* Left Column: Template Selector (4 cols) */}
            <div className="flex flex-col md:col-span-4 p-4 space-y-3 overflow-y-auto">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={mode === "canonical" ? "Filter canonical suite…" : "Search 7,515 templates…"}
                  className="h-8 w-full rounded-xl border border-border/40 bg-background/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-wiki/60 focus:outline-none"
                />
              </div>

              {/* Categories */}
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                      activeCategory === c.id
                        ? "bg-wiki/20 text-wiki font-semibold"
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
                    className={`flex w-full flex-col rounded-xl p-2.5 text-left transition-all ${
                      selectedTemplateName === t.name
                        ? "bg-wiki/15 border border-wiki/30 shadow-sm"
                        : "hover:bg-secondary/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{t.name}</span>
                      {t.isCanonical && (
                        <span className="text-[9px] font-bold text-wiki uppercase tracking-wider">Canonical</span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Parameter Form & Live Preview (8 cols) */}
            <div className="flex flex-col md:col-span-8 overflow-y-auto p-6 space-y-5">
              {/* Template Header Info */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">{selectedTemplate.name}</h4>
                    <span className="rounded-full bg-wiki/15 px-2 py-0.5 text-[10px] font-semibold text-wiki uppercase">
                      {selectedTemplate.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                </div>

                <button
                  type="button"
                  onClick={handleDuplicateIntoBuilder}
                  className="rounded-xl border border-border/40 bg-secondary/40 px-3 py-1 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Duplicate & Customize
                </button>
              </div>

              {/* Parameter Inputs Grid */}
              <div className="space-y-3 rounded-2xl border border-border/40 bg-secondary/20 p-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-foreground">Configure Parameters</h5>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedTemplate.params.map((p) => (
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
                        className="h-8 w-full rounded-xl border border-border/40 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                      />
                    </div>
                  ))}

                  {/* Custom Parameter Fields Added on the Fly */}
                  {customParams.map((cp, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-medium text-wiki">
                        <span>{cp.key} (Custom)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomParam(idx)}
                          className="text-muted-foreground hover:text-red-400"
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

                {/* Add Custom Field Inline Bar */}
                <div className="pt-2 border-t border-border/30 flex items-center gap-2">
                  <input
                    type="text"
                    value={newCustomKey}
                    onChange={(e) => setNewCustomKey(e.target.value)}
                    placeholder="+ Custom field key (e.g. founder)"
                    className="h-7 flex-1 rounded-lg border border-border/30 bg-background/80 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newCustomVal}
                    onChange={(e) => setNewCustomVal(e.target.value)}
                    placeholder="Field value"
                    className="h-7 flex-1 rounded-lg border border-border/30 bg-background/80 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-wiki/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomParam}
                    disabled={!newCustomKey.trim()}
                    className="rounded-lg bg-secondary/80 px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                  >
                    Add Field
                  </button>
                </div>
              </div>

              {/* Live Wikitext Output Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Generated Wikitext</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-wiki hover:underline"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
                <pre className="max-h-40 overflow-y-auto rounded-xl border border-border/40 bg-background/80 p-3 font-mono text-[11px] text-foreground/90">
                  {generatedWikitext}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 bg-secondary/30 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/40 bg-secondary/60 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-secondary active:scale-[0.98]"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/80 px-4 py-1.5 text-xs font-medium text-foreground hover:bg-secondary active:scale-[0.98]"
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
