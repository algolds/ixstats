"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatFileSize, type RealmWikiView } from "./RealmWikiPanel";

type Recheck = RouterOutputs["realms"]["wiki"]["recheckMap"];

const RECHECK_TONE: Record<Recheck["status"], "success" | "warning" | "destructive"> = {
  unchanged: "success",
  changed: "warning",
  missing: "destructive",
};

const RECHECK_TEXT: Record<Recheck["status"], string> = {
  unchanged: "Unchanged on the wiki",
  changed: "Changed on the wiki since it was chosen",
  missing: "No longer on the wiki",
};

/** The world map chosen from the wiki, its credit, and Re-check (compares the wiki's SHA-1 with the stored one). */
export function ChosenWikiMap({ slug, map }: { slug: string; map: NonNullable<RealmWikiView["map"]> }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const recheck = api.realms.wiki.recheckMap.useMutation({
    onSuccess: () => void utils.realms.wiki.get.invalidate({ slug }),
    onError: (e) => notify.error("Could not re-check the map", e.message),
  });
  const result = recheck.data;
  const file = map.file;

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-3 border p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-label text-headline">Chosen world map</h3>
          <p className="text-label-secondary text-footnote">
            Kept in the realm&apos;s settings for the map import. Re-check tells you whether the wiki&apos;s file
            has changed since.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={recheck.isPending} onClick={() => recheck.mutate({ slug })}>
          {recheck.isPending ? "Checking…" : "Re-check"}
        </Button>
      </div>
      <dl className="text-footnote grid gap-x-4 gap-y-1 md:grid-cols-[max-content_1fr]">
        <dt className="text-label-secondary">File</dt>
        <dd className="text-label break-all">
          {file?.descriptionUrl ? (
            <a href={file.descriptionUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-tint-ink">
              {map.source.fileTitle}
            </a>
          ) : (
            map.source.fileTitle
          )}{" "}
          ({map.source.wiki})
        </dd>
        {file && (
          <>
            <dt className="text-label-secondary">Size</dt>
            <dd className="text-label">
              {file.width}×{file.height} · {formatFileSize(file.size)} · {file.mime}
            </dd>
            <dt className="text-label-secondary">Licence</dt>
            <dd className="text-label">{file.licence ?? "Not stated"}</dd>
          </>
        )}
        <dt className="text-label-secondary">Credit</dt>
        <dd className="text-label">{map.attribution ?? "None"}</dd>
        <dt className="text-label-secondary">SHA-1</dt>
        <dd className="text-label font-mono break-all">{map.source.sha1}</dd>
        {file && (
          <>
            <dt className="text-label-secondary">Chosen</dt>
            <dd className="text-label">
              {new Date(file.chosenAt).toLocaleString()}
              {file.checkedAt && ` · last checked ${new Date(file.checkedAt).toLocaleString()}`}
            </dd>
          </>
        )}
      </dl>
      {result && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <Badge variant={RECHECK_TONE[result.status]}>{RECHECK_TEXT[result.status]}</Badge>
          {result.status === "changed" && result.current && (
            <span className="text-label-secondary text-footnote">
              Now {result.current.width}×{result.current.height}, {formatFileSize(result.current.size)}. Choose it
              again to use the new version.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
