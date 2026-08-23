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
    <div className="border-border/20 border-t pt-5">
      <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
        Define Lexicon Meaning
      </h4>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Part of Speech
            </label>
            <Select value={lexEditPos} onValueChange={setLexEditPos}>
              <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors focus:border-onoma-primary/50 focus:outline-none">
                <SelectValue placeholder="Select POS" />
              </SelectTrigger>
              <SelectContent className="border-border/40 bg-background/95 max-h-[200px] backdrop-blur-md">
                <SelectItem
                  value="Noun"
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Noun
                </SelectItem>
                <SelectItem
                  value="Adjective"
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Adjective
                </SelectItem>
                <SelectItem
                  value="Verb"
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Verb
                </SelectItem>
                <SelectItem
                  value="Proper Noun"
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Proper Noun
                </SelectItem>
                <SelectItem
                  value="Adverb"
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Adverb
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Etymological Root
            </label>
            <input
              type="text"
              value={lexEditRoot}
              onChange={(e) => setLexEditRoot(e.target.value)}
              placeholder="e.g. rom- (strength)"
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:border-onoma-primary/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Meaning / Translation
          </label>
          <input
            type="text"
            value={lexEditMeaning}
            onChange={(e) => setLexEditMeaning(e.target.value)}
            placeholder="e.g. Place of strength, capital city"
            required
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:border-onoma-primary/50 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Historical Origin & Notes
          </label>
          <textarea
            value={lexEditOrigin}
            onChange={(e) => setLexEditOrigin(e.target.value)}
            placeholder="e.g. Named after legendary founder Romus, later expanded by Latin tribes..."
            className="border-border/60 bg-background text-foreground h-20 w-full rounded-lg border px-3 py-2 text-xs focus:border-onoma-primary/50 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-onoma-primary py-2 text-xs font-bold text-white shadow-md shadow-onoma-primary/10 transition-all hover:bg-onoma-primary-light"
        >
          Save Lexicon Definition
        </button>
      </form>
    </div>
  );
}

export default LexiconDefinitionForm;
