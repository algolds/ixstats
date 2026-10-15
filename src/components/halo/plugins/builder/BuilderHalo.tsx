"use client";

/**
 * BuilderHalo: the Halo plugin for founding (`/builder`) and the country editor
 * (`/mycountry/editor`). It offers one command, "Jump to section"; the page keeps its own
 * stepper or anchor nav, saves and validation.
 */

import { useEffect, useMemo, useRef } from "react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { DIPlugin } from "~/components/halo/types";
import { JumpToSectionView } from "./views";
import type { BuilderHaloContext, BuilderHaloSection } from "./types";

export interface BuilderHaloProps {
  /** The pill's label, e.g. "Found a nation" or the nation's name. */
  label: string;
  /** Where the player can jump, in page order. */
  sections: BuilderHaloSection[];
  /** The section shown now, if the page knows it (founding's current step). */
  currentId?: string | null;
  /** Moves the page to a section (a founding step, or an editor `#hash`). */
  onJump: (id: string) => void;
}

function BuilderHaloLabel({ label }: { label: string }) {
  return (
    <span className="flex max-w-[180px] min-w-0 items-center gap-2 select-none" title={label}>
      <span className="bg-yellow h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
      <span className="text-label text-caption min-w-0 truncate font-semibold whitespace-nowrap">
        {label}
      </span>
    </span>
  );
}

export function BuilderHalo({ label, sections, currentId = null, onJump }: BuilderHaloProps) {
  // The latest jump handler, so a new closure each render does not re-register the plugin.
  const jumpRef = useRef(onJump);
  useEffect(() => {
    jumpRef.current = onJump;
  }, [onJump]);

  const sectionsKey = JSON.stringify(sections);
  const plugin = useMemo<DIPlugin<unknown, BuilderHaloContext>>(
    () => ({
      id: "builder",
      // Above MyCountry and the wiki, so the editor and founding show their own sections.
      priority: 20,
      center: <BuilderHaloLabel label={label} />,
      expandedViews: { sections: JumpToSectionView },
      accentColor: "var(--color-yellow)",
      stickyLabel: label,
      context: {
        sections: JSON.parse(sectionsKey) as BuilderHaloSection[],
        currentId,
        onJump: (id: string) => jumpRef.current(id),
      },
    }),
    [label, sectionsKey, currentId]
  );

  useDIPlugin(plugin);
  return null;
}
