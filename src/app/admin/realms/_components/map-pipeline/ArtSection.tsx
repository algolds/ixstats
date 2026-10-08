"use client";

import { useState } from "react";
import { MediaImage, Plus, Trash } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ValueSelect } from "~/components/ui/value-select";
import { uploadMapFile } from "~/app/admin/maps/_components/map-import/ImportSourceStep";
import { FieldError, PipelineSection, invalidProps } from "./fields";
import { patchItem, type ArtRow, type DraftErrors } from "./pipeline-draft";

type SourceKind = "repo" | "upload";

const SOURCE_OPTIONS = [
  ["repo", "Repository file"],
  ["upload", "Upload"],
] as const;

const ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,.geojson,.json";

interface ArtSectionProps {
  rows: ArtRow[];
  errors: DraftErrors;
  usage: Record<string, string[]>;
  realmId: string;
  source: { repo: string; ref: string } | null;
  onChange: (rows: ArtRow[]) => void;
}

function UploadCell({
  row,
  index,
  realmId,
  onUploaded,
}: {
  row: ArtRow;
  index: number;
  realmId: string;
  onUploaded: (uploadId: string, filename: string) => void;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const uploadId = "uploadId" in row.source ? row.source.uploadId : "";
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const info = await uploadMapFile(realmId, file);
      onUploaded(info.uploadId, info.filename);
    } catch (error) {
      notify.error("Upload failed", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      {uploadId && (
        <span className="text-label-secondary text-footnote">
          {("filename" in row.source && row.source.filename) || (
            <span className="font-data">{uploadId.slice(0, 12)}</span>
          )}
        </span>
      )}
      <Input
        type="file"
        accept={ACCEPT}
        aria-label={`Upload art ${index + 1}`}
        disabled={busy}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {busy && <span className="text-label-secondary text-footnote">Uploading…</span>}
    </div>
  );
}

/** The named source files every other part of the pipeline reads: a repository path or an upload each. */
export function ArtSection({ rows, errors, usage, realmId, source, onChange }: ArtSectionProps) {
  const set = (i: number, patch: Partial<ArtRow>) => onChange(patchItem(rows, i, patch));
  const setKind = (i: number, kind: SourceKind) =>
    set(i, { source: kind === "repo" ? { repoPath: "" } : { uploadId: "" } });

  return (
    <PipelineSection
      icon={<MediaImage />}
      title="Art files"
      description={
        source
          ? `Repository files are read from ${source.repo} at ${source.ref}. Uploads take PNG, JPEG, WebP, SVG or GeoJSON.`
          : "This realm has no source repository: upload its art. Uploads take PNG, JPEG, WebP, SVG or GeoJSON."
      }
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange([...rows, { key: "", source: { repoPath: "" } }])}
        >
          <Plus /> Add art
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-label-secondary text-body">
          No art yet. Every layer below names one of these files.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Path or file</TableHead>
              <TableHead>Used by</TableHead>
              <TableHead>
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const keyId = `art-${i}-key`;
              const sourceId = `art-${i}-source`;
              const kind: SourceKind = "uploadId" in row.source ? "upload" : "repo";
              return (
                <TableRow key={i}>
                  <TableCell className="align-top">
                    <Input
                      id={keyId}
                      aria-label={`Art ${i + 1} name`}
                      className="font-data w-40"
                      value={row.key}
                      onChange={(e) => set(i, { key: e.target.value.trim() })}
                      {...invalidProps(keyId, errors[`art.${i}.key`])}
                    />
                    <FieldError id={keyId} error={errors[`art.${i}.key`]} />
                  </TableCell>
                  <TableCell className="align-top">
                    <ValueSelect
                      aria-label={`Art ${i + 1} source`}
                      value={kind}
                      options={SOURCE_OPTIONS}
                      onValueChange={(next) => setKind(i, next)}
                    />
                  </TableCell>
                  <TableCell className="min-w-64 align-top">
                    {"repoPath" in row.source ? (
                      <Input
                        id={sourceId}
                        aria-label={`Art ${i + 1} repository path`}
                        value={row.source.repoPath}
                        placeholder="Overlays/Map.png"
                        onChange={(e) => set(i, { source: { repoPath: e.target.value } })}
                        {...invalidProps(sourceId, errors[`art.${i}.source`])}
                      />
                    ) : (
                      <UploadCell
                        row={row}
                        index={i}
                        realmId={realmId}
                        onUploaded={(uploadId, filename) =>
                          set(i, { source: { uploadId, filename } })
                        }
                      />
                    )}
                    <FieldError id={sourceId} error={errors[`art.${i}.source`]} />
                  </TableCell>
                  <TableCell className="text-label-secondary text-footnote align-top">
                    {usage[row.key]?.join(", ") ?? "Not used"}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove art ${row.key || i + 1}`}
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                      <Trash />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </PipelineSection>
  );
}
