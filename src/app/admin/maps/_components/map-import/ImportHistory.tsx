"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import type { MapImportContext } from "./useMapImportJob";

type ImportRow = MapImportContext["imports"][number];

/** The realm's applied map imports, newest first, with Roll back on the latest one still in place. */
export function ImportHistory({ realmId, imports }: { realmId: string; imports: ImportRow[] }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const rollback = api.geoEditor.mapImport.rollback.useMutation({
    onSuccess: (result) => {
      notify.success(
        "Import rolled back",
        `${result.restored} borders restored, ${result.deleted} removed`
      );
      void utils.geoEditor.mapImport.context.invalidate({ realmId });
      void utils.geoCore.invalidate();
    },
    onError: (error) => notify.error("Could not roll back", error.message),
  });
  if (imports.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-label text-body font-medium">Applied imports</h4>
      <ul className="divide-separator border-separator rounded-control divide-y border">
        {imports.map((row) => {
          const summary = (row.summary ?? {}) as {
            written?: number;
            deactivated?: number;
            source?: string;
          };
          return (
            <li key={row.id} className="text-footnote flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="text-label">{new Date(row.createdAt).toLocaleString()}</span>
              <Badge>{row.mode}</Badge>
              <span className="text-label-secondary">
                {summary.written ?? 0} borders
                {summary.deactivated ? `, ${summary.deactivated} retired` : ""}
                {summary.source === "pipeline" ? ` (${row.layerTypes.join(", ")} layers)` : ""}
              </span>
              {row.rolledBackAt && <Badge variant="warning">Rolled back</Badge>}
              {!row.rollbackAvailable && !row.rolledBackAt && <Badge>No snapshot</Badge>}
              {row.canRollBack && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={rollback.isPending}
                    >
                      Roll back
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Roll back this import?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The borders it changed go back to how they were, the ones it created are
                        removed, and the land areas it filled are cleared again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => rollback.mutate({ importId: row.id })}>
                        Roll back
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
