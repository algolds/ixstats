"use client";

import { useState } from "react";
import type { LoreWriterSeed } from "~/hooks/lore/useLoreWriter";
import { api } from "~/trpc/react";

/** What the writer opens on: an entry point's seed, or a piece to edit. */
interface WriterRequest {
  seed?: LoreWriterSeed;
  editTitle?: string;
}

/**
 * A country page tab's way into the lore writer: who may write (`countryLore.access`, which the writer's own query
 * shares) and the one writer the tab mounts. The writer checks no access itself, so it opens only for a viewer who
 * may write; every entry point is shown only to them too.
 */
export function useLoreEntry(countryId: string) {
  const access = api.countryLore.access.useQuery({ countryId }).data;
  const canWrite = access?.canWrite ?? false;
  const [request, setRequest] = useState<WriterRequest | null>(null);
  const open = (next: WriterRequest) => {
    if (canWrite) setRequest(next);
  };

  return {
    canWrite,
    isOwner: access?.isOwner ?? false,
    write: (seed?: LoreWriterSeed) => open({ seed }),
    edit: (title: string) => open({ editTitle: title }),
    writer: {
      open: request !== null,
      onClose: () => setRequest(null),
      seed: request?.seed,
      editTitle: request?.editTitle,
    },
  };
}
