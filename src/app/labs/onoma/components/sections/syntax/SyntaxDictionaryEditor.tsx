"use client";

// src/app/labs/onoma/components/sections/syntax/SyntaxDictionaryEditor.tsx
// Vocabulary lookup and word pair manager for syntax conlang translation

import React, { useState } from "react";
import { Page as FileText, Trash as Trash2, Plus } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";

interface SyntaxDictionaryEditorProps {
  dictionary: Record<string, string>;
  onAddWord: (key: string, val: string) => void;
  onRemoveWord: (key: string) => void;
}

export function SyntaxDictionaryEditor({
  dictionary,
  onAddWord,
  onRemoveWord,
}: SyntaxDictionaryEditorProps) {
  const [newDictKey, setNewDictKey] = useState("");
  const [newDictVal, setNewDictVal] = useState("");

  const handleAdd = () => {
    if (!newDictKey.trim() || !newDictVal.trim()) return;
    onAddWord(newDictKey.trim().toLowerCase(), newDictVal.trim());
    setNewDictKey("");
    setNewDictVal("");
  };

  return (
    <FacetMaterial
      material="satin"
      className="border-border/40 space-y-4 rounded-xl border p-5 text-left shadow-sm"
    >
      <h4 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
        <FileText className="h-4 w-4 text-fuchsia-500" /> Vocabulary Dictionary
      </h4>

      {/* Add Word Row */}
      <div className="flex gap-2 text-xs">
        <input
          type="text"
          placeholder="English Word (e.g. bird)"
          value={newDictKey}
          onChange={(e) => setNewDictKey(e.target.value)}
          className="border-border/60 bg-background flex-1 rounded border px-2.5 py-1.5 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Conlang Word (e.g. avi)"
          value={newDictVal}
          onChange={(e) => setNewDictVal(e.target.value)}
          className="border-border/60 bg-background flex-1 rounded border px-2.5 py-1.5 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          className="flex cursor-pointer items-center gap-1 rounded bg-fuchsia-500 px-3 py-1.5 font-bold text-white transition-colors hover:bg-fuchsia-600"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* Word Pairs Grid */}
      <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {Object.entries(dictionary).map(([eng, con]) => (
          <div
            key={eng}
            className="border-border/40 bg-secondary/10 flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
          >
            <span className="text-muted-foreground">{eng}:</span>
            <span className="text-foreground font-semibold">{con}</span>
            <button
              onClick={() => onRemoveWord(eng)}
              className="text-muted-foreground cursor-pointer p-0.5 transition-colors hover:text-red-500"
              title="Remove word"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </FacetMaterial>
  );
}
