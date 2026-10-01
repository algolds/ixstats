// src/components/wiki-os/shared/useMountOnFirstOpen.ts
// For a lazily loaded overlay that animates out when it closes: it is rendered from the first time
// it is opened (so its chunk is fetched then, not with the page) and stays mounted afterwards, so
// the exit animation still runs.

import { useState } from "react";

export function useMountOnFirstOpen(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened;
}
