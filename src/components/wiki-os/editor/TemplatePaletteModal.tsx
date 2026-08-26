// src/components/wiki-os/editor/TemplatePaletteModal.tsx
// Interactive Template Palette, Parameter Form Builder & Live Preview Suite
"use client";

import * as React from "react";
import { ViewGrid, Search, Copy, Check, Plus, Spark, Xmark, NavArrowDown, Edit, Eye, List } from "iconoir-react";
import { api } from "~/trpc/react";
import { VisualInfoboxPreviewCard } from "~/components/wiki-os/templates/VisualInfoboxPreviewCard";

interface TemplatePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (wikitext: string, data: Record<string, string>) => void;
}

interface TemplateParam {
  name: string;
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  default?: string;
  example?: string;
  variantOnly?: string[];
}

export interface MasterTemplatePreset {
  name: string;
  category: "sovereign" | "biography" | "defense" | "economy" | "lore" | "engine" | "formatting" | "navigation" | "citation" | "geographic";
  description: string;
  isCanonical: boolean;
  variants?: Array<{ id: string; label: string; defaultFields: string[] }>;
  params: TemplateParam[];
}

export const MASTER_TEMPLATE_PRESETS: MasterTemplatePreset[] = [
  // 1. Sovereign & Geopolitical
  {
    name: "Infobox country",
    category: "sovereign",
    description: "Master nation-state, realm, former empire, or territory factbook.",
    isCanonical: true,
    variants: [
      { id: "sovereign", label: "🏛️ Sovereign State", defaultFields: ["common_name", "official_name", "capital", "government_type", "leader_title1", "leader_name1", "population_estimate", "gdp_nominal", "currency", "image_flag", "image_coat", "motto"] },
      { id: "former", label: "📜 Former Empire / State", defaultFields: ["common_name", "official_name", "capital", "year_start", "year_end", "predecessor", "successor", "government_type", "image_flag", "image_map"] },
      { id: "subdivision", label: "🗺️ Province / Territory", defaultFields: ["common_name", "official_name", "capital", "parent_country", "governor", "area_km2", "population_estimate", "image_map"] },
    ],
    params: [
      { name: "common_name", label: "Common Name", required: true, example: "Burgundie" },
      { name: "official_name", label: "Official Name", example: "Grand Republic of Burgundie" },
      { name: "native_name", label: "Native Name", example: "Grande République de Burgundie" },
      { name: "capital", label: "Capital City", required: true, example: "Vilena", type: "wiki-page-name" },
      { name: "largest_city", label: "Largest City", example: "Vilena", type: "wiki-page-name" },
      { name: "government_type", label: "Government Structure", example: "Federal Constitutional Republic" },
      { name: "leader_title1", label: "Head of State Title", example: "President" },
      { name: "leader_name1", label: "Head of State Name", example: "Jean Dupont" },
      { name: "area_km2", label: "Land Area (km²)", example: "450000", type: "number" },
      { name: "population_estimate", label: "Population", example: "45200000", type: "number" },
      { name: "gdp_nominal", label: "Nominal GDP", example: "$1.82 Trillion", type: "currency" },
      { name: "currency", label: "Currency", example: "Burgundian Franc (BGF)" },
      { name: "image_flag", label: "Flag Vector", example: "File:Flag_of_Burgundie.svg", type: "wiki-file-name" },
      { name: "image_coat", label: "Coat of Arms", example: "File:Coat_of_Burgundie.svg", type: "wiki-file-name" },
      { name: "image_map", label: "Territory Map", example: "File:Burgundie_Locator_Map.png", type: "wiki-file-name" },
      { name: "motto", label: "National Motto", example: "Liberté, Ordre, Concorde" },
      // Former state fields
      { name: "year_start", label: "Established Year", example: "1789", variantOnly: ["former"] },
      { name: "year_end", label: "Dissolution Year", example: "1945", variantOnly: ["former"] },
      { name: "predecessor", label: "Predecessor Realm", example: "Kingdom of Vilena", type: "wiki-page-name", variantOnly: ["former"] },
      { name: "successor", label: "Successor Realm", example: "Federal Republic of Burgundie", type: "wiki-page-name", variantOnly: ["former"] },
      // Province fields
      { name: "parent_country", label: "Parent Sovereign State", example: "Burgundie", type: "wiki-page-name", variantOnly: ["subdivision"] },
      { name: "governor", label: "Governor / Chancellor", example: "Claire Delacroix", variantOnly: ["subdivision"] },
      // Engine connector
      { name: "countrydata_id", label: "IxStates Simulation Slug", example: "burgundie" },
    ],
  },
  {
    name: "Infobox settlement",
    category: "sovereign",
    description: "Cities, municipalities, provinces, and geographic landmark factbook.",
    isCanonical: true,
    variants: [
      { id: "city", label: "🏙️ City / Municipality", defaultFields: ["name", "settlement_type", "subdivision_name", "leader_title", "leader_name", "population_total", "area_km2", "image_skyline", "coordinates"] },
      { id: "landmark", label: "🏔️ Landmark / Mountain / River", defaultFields: ["name", "settlement_type", "subdivision_name", "elevation_m", "coordinates", "image_skyline"] },
    ],
    params: [
      { name: "name", label: "Settlement Name", required: true, example: "Vilena" },
      { name: "settlement_type", label: "Settlement Type", example: "Capital City & Municipality" },
      { name: "subdivision_name", label: "Country / Realm", required: true, example: "Burgundie", type: "wiki-page-name" },
      { name: "leader_title", label: "Mayor / Governor Title", example: "Mayor" },
      { name: "leader_name", label: "Leader Name", example: "Clara Vane" },
      { name: "population_total", label: "Total Population", example: "3420000", type: "number" },
      { name: "area_km2", label: "Area (km²)", example: "582", type: "number" },
      { name: "elevation_m", label: "Elevation (m)", example: "120", type: "number" },
      { name: "coordinates", label: "Coordinates (Lat, Lng)", example: "40.7128, -74.0060", type: "coordinates" },
      { name: "image_skyline", label: "Skyline Photo", example: "File:Vilena_Skyline.jpg", type: "wiki-file-name" },
    ],
  },

  // 2. Biographies & Figures
  {
    name: "Infobox person",
    category: "biography",
    description: "Universal biography for leaders, monarchs, commanders, scientists, and figures.",
    isCanonical: true,
    variants: [
      { id: "officeholder", label: "🏛️ Political Leader", defaultFields: ["name", "office", "term_start", "term_end", "political_party", "nationality", "birth_date", "birth_place", "image"] },
      { id: "monarch", label: "👑 Monarch / Sovereign", defaultFields: ["name", "title", "reign_start", "reign_end", "dynasty", "consort", "predecessor", "successor", "image"] },
      { id: "military", label: "⚔️ Military Commander", defaultFields: ["name", "rank", "allegiance", "commands", "battles", "awards", "birth_date", "image"] },
      { id: "scholar", label: "🔬 Scholar / Scientist", defaultFields: ["name", "occupation", "institution", "known_for", "prizes", "nationality", "image"] },
    ],
    params: [
      { name: "name", label: "Full Name", required: true, example: "Arthur Vance" },
      { name: "image", label: "Portrait", example: "File:Arthur_Vance.jpg", type: "wiki-file-name" },
      { name: "birth_date", label: "Birth Date", example: "14 May 1968", type: "date" },
      { name: "birth_place", label: "Birth Place", example: "Vilena, Burgundie" },
      { name: "death_date", label: "Death Date", example: "", type: "date" },
      { name: "nationality", label: "Nationality", example: "Burgundian" },
      { name: "occupation", label: "Occupation / Role", example: "High Chancellor" },
      { name: "office", label: "Public Office", example: "High Chancellor of Vesper" },
      { name: "term_start", label: "Term Start", example: "2020" },
      { name: "term_end", label: "Term End", example: "Present" },
      { name: "political_party", label: "Political Party", example: "Concord Party", type: "wiki-page-name" },
      // Monarch fields
      { name: "title", label: "Dynastic Title", example: "Emperor of Coscivia", variantOnly: ["monarch"] },
      { name: "dynasty", label: "Ruling Dynasty / House", example: "House of Vance", variantOnly: ["monarch"] },
      { name: "reign_start", label: "Reign Start", example: "1994", variantOnly: ["monarch"] },
      { name: "reign_end", label: "Reign End", example: "2018", variantOnly: ["monarch"] },
      // Military fields
      { name: "rank", label: "Military Rank", example: "General of the Army", variantOnly: ["military"] },
      { name: "allegiance", label: "Service Allegiance", example: "Armed Forces of Burgundie", variantOnly: ["military"] },
      { name: "commands", label: "Commands Held", example: "1st Armored Corps", variantOnly: ["military"] },
      { name: "battles", label: "Major Battles", example: "The Sand War", variantOnly: ["military"] },
    ],
  },

  // 3. Defense, Fleet & Warfare
  {
    name: "Infobox ship",
    category: "defense",
    description: "Warships, carriers, submarines, destroyers, and flagship vessels.",
    isCanonical: true,
    variants: [
      { id: "warship", label: "🚢 Surface Warship", defaultFields: ["name", "ship_class", "operator", "commissioned", "displacement_tons", "propulsion", "speed_knots", "armament", "armor", "ship_image"] },
      { id: "submarine", label: "⚓ Submarine", defaultFields: ["name", "ship_class", "operator", "commissioned", "displacement_tons", "test_depth_m", "propulsion", "armament", "ship_image"] },
    ],
    params: [
      { name: "name", label: "Ship Name & Hull No.", required: true, example: "BNS Vilena (BB-04)" },
      { name: "ship_class", label: "Ship Class", example: "Vilena-class Battleship" },
      { name: "operator", label: "Operating Navy", required: true, example: "Royal Burgundian Navy", type: "wiki-page-name" },
      { name: "commissioned", label: "Commissioned Date", example: "1938", type: "date" },
      { name: "displacement_tons", label: "Displacement (tonnes)", example: "45000", type: "number" },
      { name: "length_m", label: "Length (m)", example: "245", type: "number" },
      { name: "propulsion", label: "Propulsion", example: "4 Geared Steam Turbines, 150,000 shp" },
      { name: "speed_knots", label: "Top Speed (knots)", example: "30", type: "number" },
      { name: "armament", label: "Primary Armament", example: "9 × 406mm Guns, 20 × 127mm Guns" },
      { name: "armor", label: "Armor Protection", example: "Belt: 340mm, Deck: 150mm" },
      { name: "aircraft_carried", label: "Aircraft Carried", example: "3 Floatplanes" },
      { name: "test_depth_m", label: "Test Depth (m)", example: "450", type: "number", variantOnly: ["submarine"] },
      { name: "ship_image", label: "Ship Image", example: "File:BNS_Vilena.jpg", type: "wiki-file-name" },
    ],
  },
  {
    name: "Infobox military conflict",
    category: "defense",
    description: "Historical wars, tactical campaigns, naval battles, and strategic outcomes.",
    isCanonical: true,
    params: [
      { name: "conflict", label: "Conflict Name", required: true, example: "The Sand War" },
      { name: "date", label: "Date / Duration", required: true, example: "14 June 1984 – 3 August 1986" },
      { name: "place", label: "Location / Theater", required: true, example: "Northern Oakhaven Basin" },
      { name: "result", label: "Outcome / Treaty", required: true, example: "Decisive Burgundian Victory" },
      { name: "combatant1", label: "Belligerents (Side A)", example: "Burgundie & Vesper Alliance" },
      { name: "combatant2", label: "Belligerents (Side B)", example: "Paulastran Cyber Corps" },
      { name: "commanders1", label: "Commanders (Side A)", example: "Gen. Arthur Vance" },
      { name: "commanders2", label: "Commanders (Side B)", example: "Marshal Kirov" },
      { name: "casualties1", label: "Casualties (Side A)", example: "4,200 casualties" },
      { name: "casualties2", label: "Casualties (Side B)", example: "18,400 casualties" },
    ],
  },
  {
    name: "Infobox weapon",
    category: "defense",
    description: "Small arms, main battle tanks, aircraft, artillery, and missile systems.",
    isCanonical: true,
    params: [
      { name: "name", label: "Weapon / System Name", required: true, example: "MAG-17 Battle Rifle" },
      { name: "type", label: "Weapon Type", example: "Select-Fire Battle Rifle" },
      { name: "origin", label: "Origin Country", required: true, example: "Burgundie" },
      { name: "caliber", label: "Caliber / Cartridge", example: "7.62 × 51mm" },
      { name: "effective_range", label: "Effective Range", example: "600 m" },
      { name: "designer", label: "Designer / Manufacturer", example: "Vilena Armory" },
    ],
  },

  // 4. Economy & Infrastructure
  {
    name: "Infobox company",
    category: "economy",
    description: "Commercial corporations, conglomerates, central banks, and state enterprises.",
    isCanonical: true,
    params: [
      { name: "name", label: "Company Name", required: true, example: "Solcordia Energy Corp" },
      { name: "industry", label: "Industry Sector", required: true, example: "Energy & Infrastructure" },
      { name: "headquarters", label: "Headquarters", required: true, example: "Vilena, Burgundie" },
      { name: "key_people", label: "Key Executives", example: "Marcus Sterling (CEO)" },
      { name: "revenue", label: "Annual Revenue", example: "$42.5 Billion", type: "currency" },
      { name: "employees", label: "Total Employees", example: "84000", type: "number" },
      { name: "logo", label: "Logo Image", example: "File:Solcordia_Logo.svg", type: "wiki-file-name" },
      { name: "businessdata_id", label: "IxStates Corporate Slug", example: "solcordia" },
    ],
  },

  // 5. Engine Connectors
  {
    name: "CountryData",
    category: "engine",
    description: "Live real-time economic, vitality, and demographic simulation metrics connector.",
    isCanonical: true,
    params: [
      { name: "id", label: "Country Slug", required: true, example: "burgundie" },
      { name: "metric", label: "Metric Name", required: true, example: "gdp" },
      { name: "format", label: "Format (currency, compact, number)", example: "currency" },
      { name: "fallback", label: "Fallback Text", example: "$1.82T" },
    ],
  },
  {
    name: "BusinessData",
    category: "engine",
    description: "Live corporate valuation, balance sheet, and revenue indicators.",
    isCanonical: true,
    params: [
      { name: "company", label: "Company Slug", required: true, example: "solcordia" },
      { name: "metric", label: "Metric Name", required: true, example: "revenue" },
      { name: "fallback", label: "Fallback Text", example: "$42.5B" },
    ],
  },
  {
    name: "Coord",
    category: "geographic",
    description: "Geographic coordinate badge with IxWorld Voronoi spatial mesh projection.",
    isCanonical: true,
    params: [
      { name: "1", label: "Latitude", required: true, example: "40.7128" },
      { name: "2", label: "Longitude", required: true, example: "-74.0060" },
      { name: "display", label: "Display Mode", example: "inline,title" },
    ],
  },

  // 6. Editorial Layout & Citations
  {
    name: "Navbox",
    category: "navigation",
    description: "Thematic series footer navigation matrix with grouped topic links.",
    isCanonical: true,
    params: [
      { name: "title", label: "Navbox Header Title", required: true, example: "Provinces & Territories of Burgundie" },
      { name: "group1", label: "Group 1 Name", example: "Core Provinces" },
      { name: "list1", label: "Articles in Group 1", example: "[[Vilena]] • [[Oakhaven]] • [[Sudmoll]]" },
      { name: "group2", label: "Group 2 Name", example: "Autonomous Territories" },
      { name: "list2", label: "Articles in Group 2", example: "[[Vonein Basin]] • [[Seneca Islands]]" },
    ],
  },
  {
    name: "Quote box",
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
    name: "Hatnote",
    category: "formatting",
    description: "Article disambiguation notice, main article reference, or redirect banner.",
    isCanonical: true,
    params: [
      { name: "text", label: "Notice Text", required: true, example: "This article is about the sovereign state. For the capital city, see [[Vilena]]." },
      { name: "type", label: "Hatnote Type", example: "disambiguation" },
    ],
  },
  {
    name: "Cite web",
    category: "citation",
    description: "Standardized scholarly, historical, and treaty citation format.",
    isCanonical: true,
    params: [
      { name: "url", label: "Source URL", required: true, example: "https://archives.ixwiki.com/doc/142" },
      { name: "title", label: "Article Title", required: true, example: "Constitutional History of Burgundie" },
      { name: "author", label: "Author", example: "Dr. Henri Dubois" },
      { name: "publisher", label: "Publisher", example: "Vilena University Press" },
      { name: "date", label: "Release Date", example: "2018", type: "date" },
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

    const params: TemplateParam[] = [];
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
