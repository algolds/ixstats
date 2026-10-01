"use client";

// src/app/labs/onoma/components/sections/syntax/SyntaxDictionaryEditor.tsx
// Vocabulary lookup and word pair manager for syntax conlang translation

import React, { useState } from "react";
import { Page as FileText, Trash as Trash2, Plus } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";

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
    <FacetCard variant="inset" padding="none" className="space-y-4 p-5 text-left">
      <h4 className="text-label text-subhead flex items-center gap-2">
        <FileText className="text-indigo h-4 w-4" /> Vocabulary Dictionary
      </h4>

      {/* Add Word Row */}
      <div className="text-footnote flex gap-2">
        <Input
          type="text"
          placeholder="English Word (e.g. bird)"
          value={newDictKey}
          onChange={(e) => setNewDictKey(e.target.value)}
          className="flex-1"
        />
        <Input
          type="text"
          placeholder="Conlang Word (e.g. avi)"
          value={newDictVal}
          onChange={(e) => setNewDictVal(e.target.value)}
          className="flex-1"
        />
        <button
          onClick={handleAdd}
          className="rounded-control-sm bg-indigo text-on-indigo hover:bg-indigo flex cursor-pointer items-center gap-1 px-3 py-1.5 font-semibold transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* Word Pairs Grid */}
      <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {Object.entries(dictionary).map(([eng, con]) => (
          <div
            key={eng}
            className="border-separator bg-fill-4 rounded-control-sm text-footnote flex items-center justify-between border px-2.5 py-1.5"
          >
            <span className="text-label-secondary">{eng}:</span>
            <span className="text-label font-semibold">{con}</span>
            <button
              onClick={() => onRemoveWord(eng)}
              className="text-label-secondary hover:text-red cursor-pointer p-0.5 transition-colors"
              title="Remove word"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </FacetCard>
  );
}
