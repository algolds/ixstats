"use client";
// WikiOS Native Revision Diff Comparator: reads the revisions from the query string.

import { useSearchParams } from "next/navigation";
import { RevisionDiffView } from "~/components/wiki-os/history/RevisionDiffView";

export default function DiffPage() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from") || searchParams.get("oldid") || "";
  const toParam =
    searchParams.get("to") || searchParams.get("diff") || searchParams.get("revid") || "";
  // Revision ids are opaque history `revid`s; "prev" and "0" mean "the previous revision".
  const fromrev = fromParam && fromParam !== "prev" && fromParam !== "0" ? fromParam : undefined;
  const torev = toParam === "0" ? "" : toParam;

  return (
    <RevisionDiffView
      fromrev={fromrev}
      torev={torev}
      backHref="/util"
      backLabel="Back to utilities"
    />
  );
}
