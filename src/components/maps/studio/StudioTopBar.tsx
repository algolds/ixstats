"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { DiceFive, NavArrowLeft, SystemRestart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { useStudio } from "./StudioContext";
import { StudioPresetPicker } from "./StudioPresetPicker";

const MAX_SEED = 2 ** 31 - 1;

const SEED_RULE = `A seed is a whole number from 1 to ${MAX_SEED}.`;

function SeedField() {
  const { seed, setSeed, reroll } = useStudio();
  const seedId = useId();
  const ruleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [refused, setRefused] = useState(false);
  const commit = (text: string) => {
    const next = Number(text);
    const valid = text.trim() !== "" && Number.isInteger(next) && next >= 1 && next <= MAX_SEED;
    setRefused(!valid);
    // What is shown is the seed in use: text that is not one is put back
    if (!valid && input.current) input.current.value = String(seed);
    else if (next !== seed) setSeed(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      <label htmlFor={seedId} className="text-label-secondary text-footnote">
        Seed
      </label>
      {/* Re-keyed by the seed, so a reroll replaces what was typed */}
      <Input
        key={seed}
        ref={input}
        id={seedId}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_SEED}
        defaultValue={seed}
        aria-describedby={refused ? ruleId : undefined}
        onChange={() => setRefused(false)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
        className="text-footnote h-(--control-height-sm) w-32 tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={reroll}
        aria-label="Reroll seed"
        title="Reroll seed"
      >
        <DiceFive aria-hidden />
      </Button>
      {refused && (
        <p id={ruleId} role="alert" className="text-destructive text-caption">
          {SEED_RULE}
        </p>
      )}
    </div>
  );
}

/** "Draft · 0.4 s from climate", "Generating…", or the error with Retry. */
function DraftStatus() {
  const { generator, stale, fit, source, regenerate } = useStudio();
  const { state, result, error, message } = generator;

  if (state === "generating") {
    return (
      <p role="status" className="text-label-secondary text-footnote flex items-center gap-2">
        <SystemRestart aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        <span title={message || undefined}>Generating…</span>
      </p>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" className="flex items-center gap-2">
        <p className="text-destructive text-footnote">{error ?? "The world could not be made."}</p>
        <Button type="button" size="xs" variant="outline" onClick={regenerate}>
          Retry
        </Button>
      </div>
    );
  }
  if (source.kind === "fit" && fit.state === "loading") {
    return <p className="text-label-secondary text-footnote">Waiting for the realm's map</p>;
  }
  if (result) {
    const seconds = (result.generationMs / 1000).toFixed(1);
    return (
      <p role="status" className="text-label-secondary text-footnote tabular-nums">
        {stale ? "Out of date" : "Draft"} · {seconds} s from {result.restartedAt}
      </p>
    );
  }
  return <p className="text-label-secondary text-footnote">No world yet</p>;
}

/** Back to Atlas, the preset and seed, and how the draft is doing. */
export function StudioTopBar() {
  return (
    <FacetMaterial
      as="header"
      className="mx-2 mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2"
    >
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/maps">
          <NavArrowLeft aria-hidden />
          Back to Atlas
        </Link>
      </Button>
      <h1 className="text-headline">World Studio</h1>
      <StudioPresetPicker />
      <SeedField />
      <div className="ml-auto">
        <DraftStatus />
      </div>
    </FacetMaterial>
  );
}
