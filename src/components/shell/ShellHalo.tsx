"use client";

/**
 * Halo under the new shell (Facet 3 spec §7.4): the contextual island — search, notifications,
 * live activity, quick actions — floating top-centre over the content area, clear of the sidebar
 * (`--shell-sidebar-width`). Not the primary navigation. Halo hides itself on /maps, where
 * MapDynamicIsland takes over.
 */

import { CommandPalette } from "~/components/halo";

export function ShellHalo() {
  return (
    <div
      data-slot="shell-halo"
      className="z-nav pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-0 left-(--shell-sidebar-width) flex justify-center px-3"
    >
      <div className="pointer-events-auto max-w-full">
        <CommandPalette isSticky={false} scrollY={0} />
      </div>
    </div>
  );
}
