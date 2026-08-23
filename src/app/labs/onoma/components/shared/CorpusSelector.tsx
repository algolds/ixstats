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
        <label className="text-muted-foreground text-xs font-semibold select-none">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="border-border/60 bg-background/60 hover:bg-background/90 text-foreground flex h-9.5 w-full items-center justify-between rounded-xl border px-3 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-onoma-primary">
          <SelectValue placeholder="Select language profile or corpus…" />
        </SelectTrigger>
        <SelectContent className="border-border/40 bg-background/95 max-h-[340px] rounded-2xl border shadow-xl backdrop-blur-2xl">
          {/* Active Studio Lexicon */}
          {studioWords && studioWords.length > 0 && (
            <div className="border-b border-border/30 pb-1">
              <div className="text-[#ec4899] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
                Active Studio Session
              </div>
              <SelectItem
                value="studio-active"
                className="focus:bg-[#ec4899]/10 focus:text-foreground text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="compose-lexicon" size="xs" accentColor="#ec4899" />
                  <span className="font-semibold">Active Studio Lexicon</span>
                  <span className="text-muted-foreground/70 font-mono text-[10px]">
                    ({studioWords.length} words)
                  </span>
                </div>
              </SelectItem>
            </div>
          )}

          {/* User's Stashed Custom Dictionaries */}
          {stashDictionaries.length > 0 && (
            <div className="border-b border-border/30 pb-1">
              <div className="text-[#6366f1] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
                Custom Stash Dictionaries ({stashDictionaries.length})
              </div>
              {stashDictionaries.map((dict) => (
                <SelectItem
                  key={dict.id}
                  value={dict.id}
                  className="focus:bg-[#6366f1]/10 focus:text-foreground text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <OnomaGlyph name="memory-dataset" size="xs" accentColor="#6366f1" />
                    <span className="font-medium truncate max-w-[180px]">{dict.title}</span>
                    <span className="text-muted-foreground/70 font-mono text-[10px]">
                      ({dict.values.length} words)
                    </span>
                  </div>
                </SelectItem>
              ))}
            </div>
          )}

          {/* Natural Language Profiles */}
          <div>
            <div className="text-onoma-primary px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
              Natural Language Profiles ({NATURAL_PROFILES.length})
            </div>
            {NATURAL_PROFILES.map((p) => (
              <SelectItem
                key={p.value}
                value={p.value}
                className="focus:bg-onoma-primary/10 focus:text-foreground text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="sound-acoustic" size="xs" accentColor="#0091ff" />
                  <span>{p.label}</span>
                </div>
              </SelectItem>
            ))}
          </div>

          {/* Fantasy & Lineage Templates */}
          <div className="border-t border-border/30 pt-1">
            <div className="text-purple-500 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
              Fantasy & Lineage Templates ({templateProfiles.length})
            </div>
            {templateProfiles.map((t) => (
              <SelectItem
                key={t.id}
                value={t.id}
                className="focus:bg-purple-500/10 focus:text-foreground text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <OnomaGlyph name="emerge-branch" size="xs" accentColor="#8b5cf6" />
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
