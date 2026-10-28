"use client";
// The 404 of /wiki/<title> leaves when its address's query changes. Next's not-found boundary resets only when the
// pathname changes, so a client-side navigation that keeps it (the Edit, History and Add topic tabs, a missing
// page's `?action=edit&redlink=1`) would leave the 404 showing over the view the server rendered for the new
// address. The page then loads that address as a document.

import { useEffect, useState } from "react";

const reloadDocument = () => window.location.reload();

/** `query` is the address's search string now; `load` runs once it differs from the one the 404 was shown for. */
export function useLeaveNotFoundOnQueryChange(
  query: string,
  load: () => void = reloadDocument
): void {
  const [shownFor] = useState(query);
  const left = query !== shownFor;
  useEffect(() => {
    if (left) load();
  }, [left, load]);
}
