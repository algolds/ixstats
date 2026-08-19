"use client";

// src/app/labs/onoma/components/sections/OverviewSection.tsx
// Onoma Lab — Overview & Quick Generator Section (Facet Rebuild)

import { useState, useEffect, useRef, useMemo } from "react";
import { useNameBank } from "~/hooks/useNameBank";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { generateFantasySyllableName } from "~/lib/onoma/name-generator";
import { UseNameDialog } from "../shared/UseNameDialog";
import type { NameCategory, GenerateOptions } from "~/lib/onoma/types";
import { QuickGeneratorControls } from "./QuickGeneratorControls";
import { CandidateResultsPanel } from "./CandidateResultsPanel";

export function OverviewSection() {
  const bank = useNameBank();

  // Public dictionaries
  const publicDicts = useMemo(() => bank.publicDictionaries || [], [bank.publicDictionaries]);

  // Local UI State
  const [selectedDictId, setSelectedDictId] = useState<string>("");
  const [batchCount, setBatchCount] = useState<number>(20);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [order, setOrder] = useState<number>(2);

  // Markov Generation Options
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
    startsWith: "",
    endsWith: "",
    contains: "",
    excludes: "",
  });

  // Generation outputs
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedBatch, setCopiedBatch] = useState<boolean>(false);

  // Dictionary saving states
  const [dictionaryTitle, setDictionaryTitle] = useState<string>("");
  const [isSavingDict, setIsSavingDict] = useState<boolean>(false);
  const [showSaveDictForm, setShowSaveDictForm] = useState<boolean>(false);

  // Deploying name modal
  const [useName, setUseName] = useState<string | null>(null);

  const hasGeneratedOnLoad = useRef(false);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Auto-select "Iron Age States" dictionary when loaded
  useEffect(() => {
    if (publicDicts.length > 0 && !selectedDictId) {
      const ironAgeDict = publicDicts.find((d) => d.title.toLowerCase() === "iron age states");
      setSelectedDictId(ironAgeDict ? ironAgeDict.id : publicDicts[0].id);
    }
  }, [publicDicts, selectedDictId]);

  // Find currently selected dictionary details
  const selectedDict = publicDicts.find((d) => d.id === selectedDictId);

  // Auto-generate on load once a dictionary is selected
  useEffect(() => {
    if (selectedDict && !hasGeneratedOnLoad.current) {
      hasGeneratedOnLoad.current = true;
      setIsGenerating(true);
      try {
        const chain = new MarkovChain(order);
        const values = Array.isArray(selectedDict.values) ? (selectedDict.values as string[]) : [];
        chain.addWords(values);
        const results: string[] = [];
        for (let i = 0; i < batchCount; i++) {
          let name = chain.generate(options);
          if (!name) {
            name = generateFantasySyllableName();
          }
          results.push(name);
        }
        setGeneratedNames(results);
      } catch (err) {
        console.error("Failed to generate Markov names on load:", err);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [selectedDict, order, batchCount, options]);

  // Perform Generation
  const handleGenerate = () => {
    if (!selectedDict) return;
    setIsGenerating(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        // 1. Instantiate and train Markov Chain
        const chain = new MarkovChain(order);
        const values = Array.isArray(selectedDict.values) ? (selectedDict.values as string[]) : [];
        chain.addWords(values);

        // 2. Generate batch size
        const results: string[] = [];
        for (let i = 0; i < batchCount; i++) {
          let name = chain.generate(options);
          if (!name) {
            name = generateFantasySyllableName();
          }
          results.push(name);
        }

        setGeneratedNames(results);
      } catch (err) {
        console.error("Failed to generate Markov names:", err);
      } finally {
        setIsGenerating(false);
        setShowSaveDictForm(false);
      }
    }, 450);
  };

  // Save single generated name
  const handleSaveName = async (name: string, stashId?: string) => {
    const category = (selectedDict?.category as NameCategory) || "person";
    await bank.saveEntry({
      type: "saved-name",
      title: name,
      values: [name],
      category,
      stashId,
    });
  };

  // Copy entire batch
  const handleCopyBatch = async () => {
    if (generatedNames.length === 0) return;
    try {
      await navigator.clipboard.writeText(generatedNames.join(", "));
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    } catch (err) {
      console.error("Failed to copy batch:", err);
    }
  };

  // Save batch as dictionary
  const handleSaveBatchAsDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictionaryTitle.trim() || generatedNames.length === 0) return;
    setIsSavingDict(true);
    try {
      const category = (selectedDict?.category as NameCategory) || "person";
      await bank.saveEntry({
        type: "dictionary",
        title: dictionaryTitle.trim(),
        values: generatedNames,
        category,
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

  return (
    <div className="space-y-6">
      {/* Quick Generator Workspace */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Configuration Panel */}
        <div className="space-y-4 lg:col-span-5">
          <QuickGeneratorControls
            selectedDictId={selectedDictId}
            setSelectedDictId={setSelectedDictId}
            publicDicts={publicDicts}
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            options={options}
            setOptions={setOptions}
            order={order}
            setOrder={setOrder}
            isGenerating={isGenerating}
            handleGenerate={handleGenerate}
          />
        </div>

        {/* Right Column (7/12): Results Card */}
        <CandidateResultsPanel
          generatedNames={generatedNames}
          isGenerating={isGenerating}
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
        />
      </div>

      {/* Redirect Modal for deployment */}
      {useName && (
        <UseNameDialog
          isOpen={!!useName}
          onClose={() => setUseName(null)}
          name={useName}
          category={(selectedDict?.category as NameCategory) || "person"}
        />
      )}
    </div>
  );
}

export default OverviewSection;
