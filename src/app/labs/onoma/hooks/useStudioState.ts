"use client";

// src/app/labs/onoma/hooks/useStudioState.ts
// Onoma Custom Studio State Management Hook

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNameBank } from "~/hooks/useNameBank";
import { type GenerateOptions, type StudioSubTab } from "~/lib/onoma/types";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { classifyCulture } from "~/lib/onoma/lexicon/culture-classifier";
import { translateToIPA } from "~/lib/onoma/phonology";
import { transcribeToScript } from "~/lib/onoma/orthography";
import { getMorphologyDetails } from "~/lib/onoma/morphology";

export interface UseStudioStateProps {
  initialWords?: string[];
  initialTitle?: string;
  onClearInitial?: () => void;
  activeSubTab?: StudioSubTab;
  setActiveSubTab?: (tab: StudioSubTab) => void;
}

export function useStudioState({
  initialWords,
  initialTitle,
  onClearInitial,
  activeSubTab: externalActiveSubTab,
  setActiveSubTab: externalSetActiveSubTab,
}: UseStudioStateProps = {}) {
  const bank = useNameBank();

  // Lexicon Sub-Tabs & Dictionary State
  const [localActiveSubTab, setLocalActiveSubTab] = useState<StudioSubTab>("workshop");
  const activeSubTab = externalActiveSubTab ?? localActiveSubTab;
  const setActiveSubTab = externalSetActiveSubTab ?? setLocalActiveSubTab;
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [definitions, setDefinitions] = useState<
    Record<
      string,
      {
        partOfSpeech: string;
        root: string;
        meaning: string;
        origin: string;
      }
    >
  >({});

  const [lexEditPos, setLexEditPos] = useState("Noun");
  const [lexEditRoot, setLexEditRoot] = useState("");
  const [lexEditMeaning, setLexEditMeaning] = useState("");
  const [lexEditOrigin, setLexEditOrigin] = useState("");

  // Training Words Input
  const [inputText, setInputText] = useState(
    "roma, mediolanum, carthago, ravenna, verona, pompeii, florentia, corduba, toletum, tarraco"
  );

  // Generator Config
  const [order, setOrder] = useState<number>(3);
  const [batchCount, setBatchCount] = useState<number>(10);
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
    vowelHarmony: "none",
    maxConsonantCluster: 3,
    maxVowelCluster: 3,
    allowDoubleLetters: true,
  });

  // Output State
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [dictTitle, setDictTitle] = useState("");
  const [selectedDictId, setSelectedDictId] = useState("");
  const [loadedDictContent, setLoadedDictContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Visualizer Path Workshop State
  const [visualizerPrefix, setVisualizerPrefix] = useState<string>("");

  // Parse words from input text
  const trainingWords = useMemo(() => {
    return inputText
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }, [inputText]);

  // Keep a ref of trainingWords to avoid triggering useEffect during typing
  const trainingWordsRef = useRef(trainingWords);
  useEffect(() => {
    trainingWordsRef.current = trainingWords;
  }, [trainingWords]);

  // Handle generation
  const generateNames = useCallback(
    (customWords?: string[]) => {
      const words = customWords || trainingWordsRef.current;
      if (words.length === 0) return;
      const chain = new MarkovChain(order);
      chain.addWords(words);

      const names: string[] = [];
      for (let i = 0; i < batchCount; i++) {
        const name = chain.generate(options);
        if (name) {
          names.push(name);
        } else {
          // Fallback to random capitalized word from input to avoid blank cards
          const randSeed = words[Math.floor(Math.random() * words.length)];
          names.push(MarkovChain.capitalize(randSeed));
        }
      }
      setGeneratedNames(names);
    },
    [order, batchCount, options]
  );

  // Load saved input text from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && (!initialWords || initialWords.length === 0)) {
      const savedText = localStorage.getItem("onoma-studio-input-text");
      if (savedText) {
        setInputText(savedText);
        setLoadedDictContent(savedText);
        const words = savedText
          .split(/[,\n]/)
          .map((w) => w.trim())
          .filter((w) => w.length > 0);
        generateNames(words);
      } else {
        generateNames();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWords]);

  // Save input text to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("onoma-studio-input-text", inputText);
    }
  }, [inputText]);

  useEffect(() => {
    if (initialWords && initialWords.length > 0) {
      const content = initialWords.join(", ");
      setInputText(content);
      setLoadedDictContent(content);
      if (initialTitle) {
        setDictTitle(initialTitle);
      }
      generateNames(initialWords);
      onClearInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWords, initialTitle, onClearInitial]);

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let mergedText = "";
    let filesProcessed = 0;
    const fileList = Array.from(files);

    fileList.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          mergedText += (mergedText ? ", " : "") + text;
        }
        filesProcessed++;

        if (filesProcessed === fileList.length) {
          const words = mergedText
            .split(/[,\n]/)
            .map((w) => w.trim())
            .filter((w) => w.length > 0);

          setInputText((prev) => {
            const trimmedPrev = prev.trim();
            const combinedText = trimmedPrev ? `${trimmedPrev}, ${mergedText}` : mergedText;

            // Schedule the generation after state updates
            setTimeout(() => {
              const combinedWords = combinedText
                .split(/[,\n]/)
                .map((w) => w.trim())
                .filter((w) => w.length > 0);
              generateNames(combinedWords);
            }, 0);
            return combinedText;
          });

          setUploadStatus(`Loaded ${words.length} words from ${fileList.length} file(s).`);
          setTimeout(() => setUploadStatus(null), 4000);
          e.target.value = "";
        }
      };

      reader.onerror = () => {
        console.error(`Failed to read file: ${file.name}`);
        filesProcessed++;
        if (filesProcessed === fileList.length) {
          e.target.value = "";
        }
      };

      reader.readAsText(file);
    });
  };

  // Statistical culture classification based on custom seeds
  const classifiedCulture = useMemo(() => {
    if (trainingWords.length === 0) return "any";
    const sample = trainingWords.slice(0, 15).join(" ");
    return classifyCulture(sample).culture;
  }, [trainingWords]);

  // Memoized user's personal dictionaries from the name bank
  const savedDictionaries = useMemo(() => {
    if (!bank.nameBank) return [];
    return bank.nameBank.filter((entry) => entry.type === "dictionary");
  }, [bank.nameBank]);

  // Handler to populate inputText from a selected saved dictionary
  const handleLoadSavedDictionary = (dictId: string) => {
    if (!dictId) return;
    const dict = savedDictionaries.find((d) => d.id === dictId);
    if (dict) {
      setInputText(dict.values.join(", "));
      setLoadedDictContent(dict.values.join(", "));
      setDictTitle(dict.title);
      setSelectedDictId("");
      generateNames(dict.values);
    }
  };

  // Check if current input differs from the loaded dictionary (so we know if it was edited)
  const isEdited = useMemo(() => {
    return inputText.trim() !== loadedDictContent.trim();
  }, [inputText, loadedDictContent]);

  // MarkovChain instance for the visualizer
  const visualizerChain = useMemo(() => {
    if (trainingWords.length === 0) return null;
    const chain = new MarkovChain(order);
    chain.addWords(trainingWords);
    return chain;
  }, [trainingWords, order]);

  // Prepend completed name to the candidates list and speak it
  const handleCompleteName = (completedName: string) => {
    setGeneratedNames((prev) => {
      if (prev.includes(completedName)) return prev;
      return [completedName, ...prev];
    });

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(completedName);
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Save the training seeds as a dictionary to NameBank
  const handleSaveDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictTitle.trim() || trainingWords.length === 0) return;
    setIsSaving(true);
    try {
      await bank.saveEntry({
        type: "dictionary",
        title: dictTitle.trim(),
        values: trainingWords,
        isPublic: false,
      });
      setLoadedDictContent(inputText);
      setDictTitle("");
      setSuccessMsg("Dictionary saved to Name Bank successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to save dictionary:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Load conlang lexicon definitions from localStorage
  const loadDefinitions = useCallback(() => {
    if (typeof window !== "undefined") {
      const defsJson = localStorage.getItem("onoma-lexicon-definitions");
      if (defsJson) {
        setDefinitions(JSON.parse(defsJson));
      }
    }
  }, []);

  useEffect(() => {
    loadDefinitions();
    window.addEventListener("onoma-definitions-updated", loadDefinitions);
    return () => {
      window.removeEventListener("onoma-definitions-updated", loadDefinitions);
    };
  }, [loadDefinitions]);

  // Extract stashed names and define unique lexicon terms
  const stashedNames = useMemo(() => {
    if (!bank.nameBank) return [];
    return bank.nameBank.filter((entry) => entry.type === "saved-name").map((entry) => entry.title);
  }, [bank.nameBank]);

  const lexiconTerms = useMemo(() => {
    const termsSet = new Set<string>([...stashedNames, ...Object.keys(definitions)]);
    return Array.from(termsSet).sort();
  }, [stashedNames, definitions]);

  // Search filter
  const filteredTerms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return lexiconTerms;
    return lexiconTerms.filter((name) => {
      const def = definitions[name];
      const matchName = name.toLowerCase().includes(term);
      const matchRoot = def?.root?.toLowerCase().includes(term) ?? false;
      const matchMeaning = def?.meaning?.toLowerCase().includes(term) ?? false;
      return matchName || matchRoot || matchMeaning;
    });
  }, [lexiconTerms, definitions, searchTerm]);

  // Selected term profile derived hooks
  const selectedTermIpa = useMemo(() => {
    if (!selectedTerm) return "";
    return translateToIPA(selectedTerm, classifiedCulture);
  }, [selectedTerm, classifiedCulture]);

  const selectedTermCyrillic = useMemo(() => {
    if (!selectedTerm) return "";
    return transcribeToScript(selectedTerm, "cyrillic");
  }, [selectedTerm]);

  const selectedTermGreek = useMemo(() => {
    if (!selectedTerm) return "";
    return transcribeToScript(selectedTerm, "greek");
  }, [selectedTerm]);

  const selectedTermArabic = useMemo(() => {
    if (!selectedTerm) return "";
    return transcribeToScript(selectedTerm, "arabic");
  }, [selectedTerm]);

  const selectedTermMorphology = useMemo(() => {
    if (!selectedTerm) return null;
    return getMorphologyDetails(selectedTerm, classifiedCulture);
  }, [selectedTerm, classifiedCulture]);

  // Sync edit form inputs when selectedTerm changes
  useEffect(() => {
    if (selectedTerm) {
      const def = definitions[selectedTerm];
      setLexEditPos(def?.partOfSpeech || "Noun");
      setLexEditRoot(def?.root || "");
      setLexEditMeaning(def?.meaning || "");
      setLexEditOrigin(def?.origin || "");
    }
  }, [selectedTerm, definitions]);

  // Save lexicon entry from details panel
  const handleSaveLexiconDefinition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm || typeof window === "undefined") return;
    const defsJson = localStorage.getItem("onoma-lexicon-definitions") || "{}";
    const defs = JSON.parse(defsJson);
    const newDef = {
      partOfSpeech: lexEditPos,
      root: lexEditRoot,
      meaning: lexEditMeaning,
      origin: lexEditOrigin,
    };
    defs[selectedTerm] = newDef;
    localStorage.setItem("onoma-lexicon-definitions", JSON.stringify(defs));
    setDefinitions(defs);
    window.dispatchEvent(new Event("onoma-definitions-updated"));
  };

  // Delete lexicon entry from both local definitions and name bank stash
  const handleDeleteTerm = async (term: string) => {
    if (typeof window !== "undefined") {
      const defsJson = localStorage.getItem("onoma-lexicon-definitions") || "{}";
      const defs = JSON.parse(defsJson);
      delete defs[term];
      localStorage.setItem("onoma-lexicon-definitions", JSON.stringify(defs));
      setDefinitions(defs);
      window.dispatchEvent(new Event("onoma-definitions-updated"));
    }

    const stashedEntry = bank.nameBank?.find(
      (entry) => entry.type === "saved-name" && entry.title === term
    );
    if (stashedEntry) {
      try {
        await bank.deleteEntry(stashedEntry.id);
      } catch (err) {
        console.error("Failed to delete stash entry:", err);
      }
    }
    setSelectedTerm(null);
  };

  return {
    bank,
    activeSubTab,
    setActiveSubTab,
    selectedTerm,
    setSelectedTerm,
    searchTerm,
    setSearchTerm,
    definitions,
    setDefinitions,
    lexEditPos,
    setLexEditPos,
    lexEditRoot,
    setLexEditRoot,
    lexEditMeaning,
    setLexEditMeaning,
    lexEditOrigin,
    setLexEditOrigin,
    inputText,
    setInputText,
    order,
    setOrder,
    batchCount,
    setBatchCount,
    options,
    setOptions,
    generatedNames,
    setGeneratedNames,
    dictTitle,
    setDictTitle,
    selectedDictId,
    setSelectedDictId,
    loadedDictContent,
    setLoadedDictContent,
    isSaving,
    setIsSaving,
    successMsg,
    setSuccessMsg,
    visualizerPrefix,
    setVisualizerPrefix,
    uploadStatus,
    setUploadStatus,
    trainingWords,
    classifiedCulture,
    savedDictionaries,
    isEdited,
    visualizerChain,
    stashedNames,
    lexiconTerms,
    filteredTerms,
    selectedTermIpa,
    selectedTermCyrillic,
    selectedTermGreek,
    selectedTermArabic,
    selectedTermMorphology,
    generateNames,
    handleFileUpload,
    handleLoadSavedDictionary,
    handleCompleteName,
    handleSaveDictionary,
    loadDefinitions,
    handleSaveLexiconDefinition,
    handleDeleteTerm,
  };
}

export type StudioState = ReturnType<typeof useStudioState>;
