"use client";

// src/app/labs/onoma/components/sections/OverviewSection.tsx
// Onoma Lab — Overview & Quick Generator Section (Product Model: CREATE Synthesis Surface)

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNameBank } from "~/hooks/useNameBank";
import { api } from "~/trpc/react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { generateFantasySyllableName } from "~/lib/onoma/name-generator";
import { UseNameDialog } from "../shared/UseNameDialog";
import {
  loadCustomDictionaries,
  CUSTOM_DICTS_CHANGED_EVENT,
  type CustomDictionary,
} from "~/lib/onoma/custom-dictionaries";
import type { NameCategory, GenerateOptions } from "~/lib/onoma/types";
import { QuickGeneratorControls } from "./QuickGeneratorControls";
import { SynthesisResultsGrid } from "../shared/SynthesisResultsGrid";

export function OverviewSection() {
  const bank = useNameBank();
  const utils = api.useUtils();
  const logActivityMutation = api.onoma.logGeneration.useMutation();
  const logHistoryMutation = api.onoma.logEvent.useMutation();

  // Public dictionaries
  const publicDicts = useMemo(() => bank.publicDictionaries || [], [bank.publicDictionaries]);

  // Custom dictionaries from localStorage
  const [customDicts, setCustomDicts] = useState<CustomDictionary[]>([]);

  const refreshCustomDicts = useCallback(() => {
    setCustomDicts(loadCustomDictionaries());
  }, []);

  useEffect(() => {
    refreshCustomDicts();
    const handleStorage = () => refreshCustomDicts();
    window.addEventListener(CUSTOM_DICTS_CHANGED_EVENT, handleStorage);
    return () => {
      window.removeEventListener(CUSTOM_DICTS_CHANGED_EVENT, handleStorage);
    };
  }, [refreshCustomDicts]);

  // Combined dictionary map
  const allDicts = useMemo(() => {
    return [...customDicts, ...publicDicts];
  }, [customDicts, publicDicts]);

  // Local UI State
  const [selectedDictId, setSelectedDictId] = useState<string>("");
  const [customWords, setCustomWords] = useState<string[] | null>(null);
  const [batchCount, setBatchCount] = useState<number>(15);
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Auto-select "Iron Age States" dictionary when loaded
  useEffect(() => {
    if (allDicts.length > 0 && !selectedDictId) {
      const ironAgeDict = publicDicts.find((d) => d.title.toLowerCase() === "iron age states");
      setSelectedDictId(ironAgeDict ? ironAgeDict.id : allDicts[0].id);
    }
  }, [allDicts, publicDicts, selectedDictId]);

  // Find currently selected dictionary details
  const selectedDict = allDicts.find((d) => d.id === selectedDictId);

  // Reset custom words when dictionary selection changes
  const handleDictChange = (id: string) => {
    setSelectedDictId(id);
    setCustomWords(null);
  };

  // Auto-generate on load once a dictionary is selected
  useEffect(() => {
    if (selectedDict && !hasGeneratedOnLoad.current) {
      hasGeneratedOnLoad.current = true;
      setIsGenerating(true);
      try {
        const chain = new MarkovChain(order);
        const values =
          customWords && customWords.length > 0
            ? customWords
            : Array.isArray(selectedDict.values)
              ? (selectedDict.values as string[])
              : [];
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
  }, [selectedDict, order, batchCount, options, customWords]);

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
        const values =
          customWords && customWords.length > 0
            ? customWords
            : Array.isArray(selectedDict.values)
              ? (selectedDict.values as string[])
              : [];
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

        // 3. Log generation event with unique run hash to live history
        if (results.length > 0) {
          const runHash = `onoma-${Math.random().toString(36).substring(2, 7)}${Date.now().toString(36).slice(-4)}`;
          const cat = (selectedDict?.category as string) || "sandbox";

          logActivityMutation
            .mutateAsync({
              count: results.length,
              category: cat,
            })
            .catch(() => {});

          logHistoryMutation
            .mutateAsync({
              sessionId: runHash,
              names: results,
              category: cat,
              culturalProfile: selectedDict?.title || "Custom",
              trainingMode: "markov",
              parameters: {
                ...options,
                order,
                dictTitle: selectedDict?.title,
                dictId: selectedDict?.id,
                batchCount: results.length,
              },
              count: results.length,
            })
            .then(() => {
              void utils.onoma.getHistory.invalidate();
              void utils.onoma.getStats.invalidate();
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("Failed to generate Markov names:", err);
      } finally {
        setIsGenerating(false);
        setShowSaveDictForm(false);
      }
    }, 350);
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
    <div className="space-y-5">
      {/* 30% Controls + 70% Results Layout */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-10">
        {/* 30% Control Column */}
        <div className="lg:col-span-3">
          <QuickGeneratorControls
            selectedDictId={selectedDictId}
            setSelectedDictId={handleDictChange}
            customWords={customWords}
            setCustomWords={setCustomWords}
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

        {/* 70% Candidate Results Column */}
        <div className="lg:col-span-7">
          <SynthesisResultsGrid
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
            category={(selectedDict?.category as string) || "sandbox"}
          />
        </div>
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
