"use client";

// src/app/labs/onoma/components/sections/syntax/SyntaxDictionaryEditor.tsx
// Vocabulary lookup and word pair manager for syntax conlang translation

import React, { useState } from "react";
import { Page as FileText, Trash as Trash2, Plus } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

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
    <Card variant="inset" padding="none" className="space-y-4 p-5 text-left">
      <h4 className="text-label text-subhead flex items-center gap-2">
        <FileText className="text-indigo h-4 w-4" /> Vocabulary dictionary
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
        <Button variant="default" size="sm" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {/* Word Pairs Grid */}
      <div className="grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {Object.entries(dictionary).map(([eng, con]) => (
          <div
            key={eng}
            className="border-separator bg-fill-4 rounded-control-sm text-footnote flex items-center justify-between border px-3 py-2"
          >
            <span className="text-label-secondary">{eng}:</span>
            <span className="text-label font-semibold">{con}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemoveWord(eng)}
              title="Remove word"
              aria-label="Remove word"
              className="text-label-secondary hover:text-red"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
