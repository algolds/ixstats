"use client";

// src/app/labs/onoma/components/sections/studio/LexiconDefinitionForm.tsx
// Onoma Custom Studio Workshop — Lexicon Definition Form Component

import { ValueSelect } from "~/components/ui/value-select";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

interface LexiconDefinitionFormProps {
  lexEditPos: string;
  setLexEditPos: (val: string) => void;
  lexEditRoot: string;
  setLexEditRoot: (val: string) => void;
  lexEditMeaning: string;
  setLexEditMeaning: (val: string) => void;
  lexEditOrigin: string;
  setLexEditOrigin: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LexiconDefinitionForm({
  lexEditPos,
  setLexEditPos,
  lexEditRoot,
  setLexEditRoot,
  lexEditMeaning,
  setLexEditMeaning,
  lexEditOrigin,
  setLexEditOrigin,
  onSubmit,
}: LexiconDefinitionFormProps) {
  return (
    <div className="border-separator border-t pt-5">
      <h4 className="text-label-secondary text-subhead mb-3">Define lexicon meaning</h4>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-label-secondary text-subhead">Part of speech</label>
            <ValueSelect
              value={lexEditPos}
              onValueChange={setLexEditPos}
              options={[
                ["Noun", "Noun"],
                ["Adjective", "Adjective"],
                ["Verb", "Verb"],
                ["Proper Noun", "Proper noun"],
                ["Adverb", "Adverb"],
              ]}
              className="text-footnote w-full"
              placeholder="Select POS"
              contentClassName="max-h-[200px]"
              itemClassName="text-footnote"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-secondary text-subhead">Etymological root</label>
            <Input
              type="text"
              value={lexEditRoot}
              onChange={(e) => setLexEditRoot(e.target.value)}
              placeholder="e.g. rom- (strength)"
              className="text-footnote w-full"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-label-secondary text-subhead">Meaning / Translation</label>
          <Input
            type="text"
            value={lexEditMeaning}
            onChange={(e) => setLexEditMeaning(e.target.value)}
            placeholder="e.g. Place of strength, capital city"
            required
            className="text-footnote w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-label-secondary text-subhead">Historical origin & notes</label>
          <Textarea
            value={lexEditOrigin}
            onChange={(e) => setLexEditOrigin(e.target.value)}
            placeholder="e.g. Named after legendary founder Romus, later expanded by Latin tribes..."
            className="text-footnote h-20 w-full"
          />
        </div>

        <Button size="sm" type="submit" className="w-full">
          Save lexicon definition
        </Button>
      </form>
    </div>
  );
}
