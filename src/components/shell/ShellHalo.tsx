"use client";

/**
 * Halo in the shell: the contextual island (search, notifications, live activity, quick actions)
 * floating top-centre over the content area, clear of the sidebar (`--shell-sidebar-width`) and the
 * Inspector gutter (`--shell-inspector-width`, zero on pages without one). Page toolbars reserve
 * their middle in that same column, so Halo sits over the reserve on every page. It is not the
 * primary navigation. Halo hides itself on /maps, where MapDynamicIsland takes over.
 */

import { CommandPalette } from "~/components/halo";

export function ShellHalo() {
  return (
    <div
      data-slot="shell-halo"
      className="z-nav pointer-events-none fixed top-(--shell-page-top) right-(--shell-inspector-width) left-(--shell-sidebar-width) flex justify-center px-3"
    >
      <div className="pointer-events-auto max-w-full">
        <CommandPalette isSticky={false} scrollY={0} />
      </div>
    </div>
  );
}
