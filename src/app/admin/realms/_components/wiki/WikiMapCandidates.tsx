"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatFileSize } from "./RealmWikiPanel";

type MapData = Extract<RouterOutputs["realms"]["wiki"]["discover"], { kind: "maps" }>["data"];

/** Candidate world maps, best first: thumbnail, size, licence, credit and "Use this map". */
export function WikiMapCandidates({
  slug,
  maps,
  chosen,
}: {
  slug: string;
  maps: MapData;
  chosen: string | null;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const choose = api.realms.wiki.chooseMap.useMutation({
    onSuccess: ({ map }) => {
      notify.success(
        "Map chosen",
        map.file
          ? `${map.source.fileTitle}: ${map.file.width}×${map.file.height}, ${formatFileSize(map.file.size)}, SHA-1 checked.`
          : map.source.fileTitle
      );
      void utils.realms.wiki.get.invalidate({ slug });
    },
    onError: (e) => notify.error("Could not use that map", e.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-label text-body font-semibold">Candidate world maps</h4>
        <p className="text-label-secondary text-footnote">
          {maps.categories.length > 0 ? `Searched ${maps.categories.join(", ")}` : "No map categories found"}
          {maps.unread > 0 && `; ${maps.unread} files not read yet`}. Ranked for a flat political map: large,
          about twice as wide as tall, PNG or SVG.
        </p>
      </div>
      {maps.candidates.length === 0 ? (
        <p className="text-label-secondary text-body">No candidate maps found. Add a map category in the settings.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {maps.candidates.map((map) => {
            const isChosen = chosen === map.fileTitle;
            return (
              <li key={map.fileTitle} className="border-separator rounded-row flex flex-col gap-2 border p-3">
                {map.thumbUrl && (
                  <img
                    src={map.thumbUrl}
                    alt={map.fileTitle}
                    loading="lazy"
                    className="bg-fill-4 rounded-control h-32 w-full object-contain"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label text-footnote font-semibold break-all">
                    {map.fileTitle.replace(/^File:/, "")}
                  </span>
                  {isChosen && <Badge variant="success">Chosen</Badge>}
                </div>
                <span className="text-label-secondary text-footnote">
                  {map.width}×{map.height} · {formatFileSize(map.size)} · {map.mime.replace("image/", "")} · score{" "}
                  {map.score.toFixed(2)}
                </span>
                <span className="text-label-secondary text-footnote">
                  {map.licence ?? "Licence not stated"} · {map.attribution}
                </span>
                <span className="text-label-secondary text-footnote">Found in {map.foundIn.join(", ")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={isChosen ? "outline" : "default"}
                    disabled={choose.isPending}
                    onClick={() => choose.mutate({ slug, fileTitle: map.fileTitle })}
                  >
                    {choose.isPending && choose.variables?.fileTitle === map.fileTitle
                      ? "Fetching the original…"
                      : isChosen
                        ? "Use again"
                        : "Use this map"}
                  </Button>
                  {map.descriptionUrl && (
                    <a
                      href={map.descriptionUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-tint-ink text-footnote"
                    >
                      File page
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
