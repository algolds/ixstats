"use client";

import type { DIViewProps } from "~/components/halo/types";
import { HaloViewHeader } from "~/components/halo/views/shared/HaloViewParts";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { BuilderHaloContext } from "../types";

/** Halo's expanded builder view: the page's sections, one tap away. */
export function JumpToSectionView({ onClose, context }: DIViewProps<unknown, BuilderHaloContext>) {
  const sections = context?.sections ?? [];
  return (
    <div className="flex w-full flex-col gap-3 p-4 text-left">
      <HaloViewHeader
        title="Jump to section"
        titleId="builder-halo-jump"
        onClose={onClose}
        className="mb-0"
      />
      <ul aria-labelledby="builder-halo-jump" className="flex flex-col gap-1">
        {sections.map((section) => {
          const current = section.id === context?.currentId;
          return (
            <li key={section.id}>
              <Button
                type="button"
                variant="ghost"
                aria-current={current ? "step" : undefined}
                onClick={() => {
                  onClose();
                  context?.onJump(section.id);
                }}
                className={cn("w-full justify-start", current && "text-yellow")}
              >
                {section.label}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
