"use client";

import { Xmark as X } from "iconoir-react";
import type { DIViewProps } from "~/components/halo/types";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { BuilderHaloContext } from "../types";

/** Halo's expanded builder view: the page's sections, one tap away. */
export function JumpToSectionView({ onClose, context }: DIViewProps<unknown, BuilderHaloContext>) {
  const sections = context?.sections ?? [];
  return (
    <div className="flex w-full flex-col gap-3 p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 id="builder-halo-jump" className="text-headline text-label">
          Jump to section
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-label-secondary hover:text-label"
          aria-label="Close"
        >
          <X aria-hidden />
        </Button>
      </div>
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
