"use client";

// src/app/labs/onoma/components/shared/GeneratorPanel.tsx
// Onoma Lab — Unified Name Generation UI Panel (Delegates to modular DomainControlBar and SynthesisResultsGrid)

import { useState, useEffect } from "react";
import { DomainControlBar } from "./DomainControlBar";
import { SynthesisResultsGrid } from "./SynthesisResultsGrid";
import { UseNameDialog } from "./UseNameDialog";
import { useOnomaGenerator } from "~/hooks/useOnomaGenerator";
import { useNameBank } from "~/hooks/useNameBank";
import type { NameCategory, CulturalProfile } from "~/lib/onoma/types";

interface GeneratorPanelProps {
  category: NameCategory;
  title: string;
  description: string;
  subTypes?: { value: string; label: string }[];
  defaultSubType?: string;
}

export function GeneratorPanel({
  category,
  title,
  description,
  subTypes = [],
  defaultSubType = "generic",
}: GeneratorPanelProps) {
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

  // Set category and subType initial values
  useEffect(() => {
    gen.setCategory(category);
    if (defaultSubType) gen.setSubType(defaultSubType);
  }, [category, defaultSubType]);

  const handleGenerate = () => {
    gen.generate(batchCount);
    setShowSaveDictForm(false);
  };

  const handleSaveName = async (name: string, stashId?: string) => {
    await bank.saveEntry({
      type: "saved-name",
      title: name,
      values: [name],
      category,
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
        category,
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
      {/* Header Info */}
      <div className="border-border/40 space-y-1 border-b pb-3.5">
        <h2 className="text-foreground text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>

      {/* Domain Control Bar */}
      <DomainControlBar
        category={category}
        subTypes={subTypes}
        gen={gen}
        batchCount={batchCount}
        setBatchCount={setBatchCount}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        handleGenerate={handleGenerate}
      />

      {/* Synthesis Results Grid */}
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
        category={category}
        scoreNaturalness={(n) => gen.scoreNaturalness(n)}
      />

      {/* Redirect Modal */}
      {useName && (
        <UseNameDialog
          isOpen={!!useName}
          onClose={() => setUseName(null)}
          name={useName}
          category={category}
        />
      )}
    </div>
  );
}

export default GeneratorPanel;
