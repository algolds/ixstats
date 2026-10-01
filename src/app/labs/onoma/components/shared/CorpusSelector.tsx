"use client";

// src/app/labs/onoma/components/shared/CorpusSelector.tsx
// Onoma Lab — Universal Corpus & Language Profile Selector (Apple SF & Facet Design)
// Bridges Natural Profiles, Fantasy Templates, Custom Stash Dictionaries, and Active Studio Lexicon

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNameBank } from "~/hooks/useNameBank";
import { getAllTemplateLinguisticProfiles } from "~/lib/onoma/template-phonetics";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import { cn } from "~/lib/utils";

const NATURAL_PROFILES = [
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Near Eastern" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
];

export interface CorpusOption {
  id: string;
  label: string;
  type: "natural" | "template" | "stash" | "studio";
  wordsCount?: number;
}

interface CorpusSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  studioWords?: string[];
  className?: string;
  disabled?: boolean;
}

export function CorpusSelector({
  value,
  onChange,
  label,
  studioWords,
  className,
  disabled = false,
}: CorpusSelectorProps) {
  const bank = useNameBank();

  // Extract saved dictionaries from Stash
  const stashDictionaries = React.useMemo(() => {
    if (!bank.nameBank) return [];
    return bank.nameBank.filter((item) => item.type === "dictionary" && item.values?.length > 0);
  }, [bank.nameBank]);

  const templateProfiles = React.useMemo(() => {
    return getAllTemplateLinguisticProfiles();
  }, []);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-label-secondary text-footnote font-semibold select-none">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="text-footnote h-9.5 w-full">
          <SelectValue placeholder="Select language profile or corpus…" />
        </SelectTrigger>
        <SelectContent className="max-h-[340px]">
          {/* Active Studio Lexicon */}
          {studioWords && studioWords.length > 0 && (
            <div className="border-separator border-b pb-1">
              <div className="text-tint text-eyebrow px-2.5 py-1">Active Studio Session</div>
              <SelectItem value="studio-active" className="text-footnote">
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="compose-lexicon" size="xs" accentColor="#0091ff" />
                  <span className="font-semibold">Active Studio Lexicon</span>
                  <span className="text-label-secondary text-caption font-mono">
                    ({studioWords.length} words)
                  </span>
                </div>
              </SelectItem>
            </div>
          )}

          {/* User's Stashed Custom Dictionaries */}
          {stashDictionaries.length > 0 && (
            <div className="border-separator border-b pb-1">
              <div className="text-eyebrow text-indigo px-2.5 py-1">
                Custom Stash Dictionaries ({stashDictionaries.length})
              </div>
              {stashDictionaries.map((dict) => (
                <SelectItem key={dict.id} value={dict.id} className="text-footnote">
                  <div className="flex items-center gap-2">
                    <OnomaGlyph name="memory-dataset" size="xs" accentColor="#6366f1" />
                    <span className="max-w-[180px] truncate font-medium">{dict.title}</span>
                    <span className="text-label-secondary text-caption font-mono">
                      ({dict.values.length} words)
                    </span>
                  </div>
                </SelectItem>
              ))}
            </div>
          )}

          {/* Natural Language Profiles */}
          <div>
            <div className="text-tint text-eyebrow px-2.5 py-1">
              Natural Language Profiles ({NATURAL_PROFILES.length})
            </div>
            {NATURAL_PROFILES.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-footnote">
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="sound-acoustic" size="xs" accentColor="#0091ff" />
                  <span>{p.label}</span>
                </div>
              </SelectItem>
            ))}
          </div>

          {/* Fantasy & Lineage Templates */}
          <div className="border-separator border-t pt-1">
            <div className="text-eyebrow text-indigo px-2.5 py-1">
              Fantasy & Lineage Templates ({templateProfiles.length})
            </div>
            {templateProfiles.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-footnote">
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="emerge-branch" size="xs" accentColor="#6366f1" />
                  <span>{t.name}</span>
                </div>
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}

export default CorpusSelector;
