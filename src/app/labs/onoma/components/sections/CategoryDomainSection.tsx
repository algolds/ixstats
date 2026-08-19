"use client";

// src/app/labs/onoma/components/sections/CategoryDomainSection.tsx
// Unified declarative domain section powered by domain-taxonomies.ts and horizontal Synthesis Surface

import React, { useState, useEffect } from "react";
import { FacetTabs } from "~/components/ui/facet";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { DomainControlBar } from "../shared/DomainControlBar";
import { SynthesisResultsGrid } from "../shared/SynthesisResultsGrid";
import { UseNameDialog } from "../shared/UseNameDialog";
import { useOnomaGenerator } from "~/hooks/useOnomaGenerator";
import { useNameBank } from "~/hooks/useNameBank";
import type { NameCategory, CulturalProfile } from "~/lib/onoma/types";
import { DOMAIN_CONFIGS } from "./domain-taxonomies";

interface CategoryDomainSectionProps {
  domain: "places" | "people" | "organizations" | "culture" | "military";
}

const DOMAIN_NOTATIONS: Record<string, { notation: string; badge: string; accentColor: string }> = {
  places: {
    notation: "σ₁·σ₂",
    badge: "Toponyms & Settlements",
    accentColor: "#10b981",
  },
  people: {
    notation: "Patronym",
    badge: "Anthroponyms & Dynasties",
    accentColor: "#a855f7",
  },
  organizations: {
    notation: "Guild",
    badge: "Polities & Institutions",
    accentColor: "#f59e0b",
  },
  culture: {
    notation: "Ethnos",
    badge: "Ethnonyms & Traditions",
    accentColor: "#06b6d4",
  },
  military: {
    notation: "Matrix",
    badge: "Units & Formations",
    accentColor: "#ef4444",
  },
};

export function CategoryDomainSection({ domain }: CategoryDomainSectionProps) {
  const config = DOMAIN_CONFIGS[domain];
  const [activeTab, setActiveTab] = useState<NameCategory>(config?.defaultTab || "city");

  const gen = useOnomaGenerator();
  const bank = useNameBank();

  // Local UI State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [useName, setUseName] = useState<string | null>(null);
  const [dictionaryTitle, setDictionaryTitle] = useState("");
  const [isSavingDict, setIsSavingDict] = useState(false);
  const [showSaveDictForm, setShowSaveDictForm] = useState(false);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Sync category with active tab
  useEffect(() => {
    gen.setCategory(activeTab);
    const tabObj = config?.tabs.find((t) => t.id === activeTab);
    const defSubType = tabObj?.subTypes?.[0]?.value || "generic";
    gen.setSubType(defSubType);
  }, [activeTab, config]);

  if (!config) return null;

  const currentTab = config.tabs.find((t) => t.id === activeTab) || config.tabs[0];
  const meta = DOMAIN_NOTATIONS[domain] || {
    notation: "CVC",
    badge: "Domain Synthesis",
    accentColor: "#0091ff",
  };

  const handleGenerate = () => {
    gen.generate(batchCount);
    setShowSaveDictForm(false);
  };

  const handleSaveName = async (name: string, stashId?: string) => {
    await bank.saveEntry({
      type: "saved-name",
      title: name,
      values: [name],
      category: activeTab,
      culturalProfile: gen.culture !== "any" ? (gen.culture as CulturalProfile) : null,
      stashId,
    });
  };

  const handleSaveBatchAsDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictionaryTitle.trim() || gen.generatedNames.length === 0) return;
    setIsSavingDict(true);
    try {
      await bank.saveEntry({
        type: "dictionary",
        title: dictionaryTitle.trim(),
        values: gen.generatedNames,
        category: activeTab,
        culturalProfile: gen.culture !== "any" ? (gen.culture as CulturalProfile) : null,
        isPublic: false,
      });
      setDictionaryTitle("");
      setShowSaveDictForm(false);
    } catch (err) {
      console.error("Failed to save dictionary:", err);
    } finally {
      setIsSavingDict(false);
    }
  };

  const handleCopyBatch = async () => {
    if (gen.generatedNames.length === 0) return;
    try {
      await navigator.clipboard.writeText(gen.generatedNames.join(", "));
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    } catch (err) {
      console.error("Failed to copy batch:", err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Contextual Domain Header with Monospace Graphic Notation and light specular line */}
      <div
        className="relative overflow-hidden rounded-xl border p-4 shadow-xs"
        style={{
          borderColor: `${meta.accentColor}30`,
          background: `linear-gradient(90deg, ${meta.accentColor}0f, ${meta.accentColor}03, transparent)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, ${meta.accentColor}40, transparent)`,
          }}
        />


        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border"
                style={{
                  borderColor: `${meta.accentColor}40`,
                  backgroundColor: `${meta.accentColor}15`,
                  color: meta.accentColor,
                }}
              >
                ⟨{meta.notation}⟩
              </span>
              <h2 className="text-foreground text-lg font-bold tracking-tight">
                {currentTab.label}
              </h2>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                · {meta.badge}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {currentTab.desc}
            </p>
          </div>
        </div>
      </div>


      {/* Domain Subcategory Sliding Tabs (if more than 1 tab) */}
      {config.tabs.length > 1 && (
        <FacetTabs
          tabs={config.tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as NameCategory)}
          tone="accent"
          size="sm"
        />
      )}

      {/* 30% Controls + 70% Results Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-10 items-start">
        {/* 30% Control Column */}
        <div className="lg:col-span-3">
          <DomainControlBar
            category={activeTab}
            subTypes={currentTab.subTypes || []}
            gen={gen}
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            handleGenerate={handleGenerate}
          />
        </div>

        {/* 70% Candidate Results Column */}
        <div className="lg:col-span-7">
          <SynthesisResultsGrid
            generatedNames={gen.generatedNames}
            isGenerating={gen.isGenerating}
            copiedBatch={copiedBatch}
            handleCopyBatch={handleCopyBatch}
            showSaveDictForm={showSaveDictForm}
            setShowSaveDictForm={setShowSaveDictForm}
            dictionaryTitle={dictionaryTitle}
            setDictionaryTitle={setDictionaryTitle}
            handleSaveBatchAsDictionary={handleSaveBatchAsDictionary}
            isSavingDict={isSavingDict}
            nameBank={bank.nameBank}
            handleSaveName={handleSaveName}
            onUseName={(n) => setUseName(n)}
            culture={gen.culture}
            subType={gen.subType}
            category={activeTab}
            scoreNaturalness={(n) => gen.scoreNaturalness(n)}
          />
        </div>
      </div>

      {/* Redirect Modal for deployment */}
      {useName && (
        <UseNameDialog
          isOpen={!!useName}
          onClose={() => setUseName(null)}
          name={useName}
          category={activeTab}
        />
      )}
    </div>
  );
}

export default CategoryDomainSection;
