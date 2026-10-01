"use client";

// src/app/labs/onoma/components/sections/studio/LexiconDefinitionForm.tsx
// Onoma Custom Studio Workshop — Lexicon Definition Form Component

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
      <h4 className="text-label-secondary text-subhead mb-3">Define Lexicon Meaning</h4>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-label-secondary text-subhead">Part of Speech</label>
            <Select value={lexEditPos} onValueChange={setLexEditPos}>
              <SelectTrigger className="text-footnote w-full">
                <SelectValue placeholder="Select POS" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                <SelectItem value="Noun" className="text-footnote">
                  Noun
                </SelectItem>
                <SelectItem value="Adjective" className="text-footnote">
                  Adjective
                </SelectItem>
                <SelectItem value="Verb" className="text-footnote">
                  Verb
                </SelectItem>
                <SelectItem value="Proper Noun" className="text-footnote">
                  Proper Noun
                </SelectItem>
                <SelectItem value="Adverb" className="text-footnote">
                  Adverb
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-secondary text-subhead">Etymological Root</label>
            <Input
              type="text"
              value={lexEditRoot}
              onChange={(e) => setLexEditRoot(e.target.value)}
              placeholder="e.g. rom- (strength)"
              className="text-footnote w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <label className="text-label-secondary text-subhead">Historical Origin & Notes</label>
          <Textarea
            value={lexEditOrigin}
            onChange={(e) => setLexEditOrigin(e.target.value)}
            placeholder="e.g. Named after legendary founder Romus, later expanded by Latin tribes..."
            className="text-footnote h-20 w-full"
          />
        </div>

        <Button size="sm" type="submit" className="w-full">
          Save Lexicon Definition
        </Button>
      </form>
    </div>
  );
}

export default LexiconDefinitionForm;
