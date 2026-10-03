"use client";

import { useState } from "react";
import {
  CheckCircle as CheckCircle2,
  Clock,
  Component as Layers,
  Copy,
  Eye,
  MediaImage as ImageIcon,
  Play,
  Undo as RotateCcw,
  Sparks as Sparkles,
  SystemRestart as Loader2,
  Trash as Trash2,
  WarningTriangle as AlertTriangle,
  Xmark as X,
  XmarkCircle as XCircle,
} from "iconoir-react";
import { IIWikiBadge } from "~/components/cards/display/IIWikiLogo";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { isNamedAuthor, toArtworkPreview, type ArtworkPreview, type BatchCandidate } from "./types";
import type { useLoreBatchQueue } from "./useLoreBatchQueue";

type StatusFilter = "ALL" | BatchCandidate["status"];

const TABLE_COLUMNS = [
  ["Artwork", "w-14 px-3 text-center"],
  ["Article title", "px-4"],
  ["Source", "px-4"],
  ["Target rarity", "px-4"],
  ["Season", "px-4"],
  ["Status & error diagnostics", "px-4"],
  ["Actions", "px-4 text-right"],
] as const;

interface CandidateQueueCardProps {
  queue: ReturnType<typeof useLoreBatchQueue>;
  duplicateCount: number;
  onPreview: (preview: ArtworkPreview) => void;
  onShowError: (candidate: BatchCandidate) => void;
  onPurgeDuplicates: () => void;
  onBackfillAuthors: () => void;
  onReclassify: () => void;
}

function StatusCell({
  candidate: c,
  onShowError,
}: {
  candidate: BatchCandidate;
  onShowError: (candidate: BatchCandidate) => void;
}) {
  if (c.status === "generating") {
    return (
      <span className="text-caption text-blue inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Generating...
      </span>
    );
  }
  if (c.status === "success") {
    return (
      <span className="text-caption text-green inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Minted ({c.generatedCardId?.slice(0, 8)})
      </span>
    );
  }
  if (c.status === "error") {
    return (
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShowError(c)}
          className="bg-red/15 text-red-ink hover:bg-red/25 self-start rounded-full px-2"
          title="Click to view full failure diagnostic"
        >
          <XCircle aria-hidden />
          Failed
        </Button>
        {c.errorMessage && (
          <span
            onClick={() => onShowError(c)}
            className="text-caption text-red line-clamp-1 max-w-[240px] cursor-pointer hover:underline"
            title={c.errorMessage}
          >
            {c.errorMessage}
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="text-label-secondary text-footnote inline-flex items-center gap-1">
      <Clock className="h-3 w-3" /> Queued
    </span>
  );
}

interface CandidateRowProps {
  candidate: BatchCandidate;
  isBusy: boolean;
  onPreview: (preview: ArtworkPreview) => void;
  onShowError: (candidate: BatchCandidate) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

function CandidateRow({
  candidate: c,
  isBusy,
  onPreview,
  onShowError,
  onRetry,
  onRemove,
}: CandidateRowProps) {
  const artwork = c.mintedArtwork || c.imageUrl;
  const preview = () => onPreview(toArtworkPreview(c));
  return (
    <TableRow>
      <TableCell className="px-3 text-center">
        {artwork ? (
          <Button
            variant="secondary"
            size="icon-lg"
            aria-label={`Inspect artwork for ${c.articleTitle}`}
            onClick={preview}
            className="group border-separator mx-auto size-10 overflow-hidden border bg-black/40 p-0"
            title="Click to inspect full image"
          >
            <img src={artwork} alt="" className="h-full w-full object-cover" />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Eye className="size-3.5 text-white" />
            </span>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="icon-lg"
            aria-label={`Inspect details for ${c.articleTitle} (no image)`}
            onClick={preview}
            className="border-separator text-label-secondary hover:text-label mx-auto size-10 border"
            title="No primary image parsed. Click to inspect details"
          >
            <ImageIcon aria-hidden className="h-4 w-4" />
          </Button>
        )}
      </TableCell>

      <TableCell className="text-label min-w-64 px-4 font-semibold whitespace-normal">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>{c.articleTitle}</span>
            {c.category && <Badge variant="secondary">{c.category}</Badge>}
          </div>
          {isNamedAuthor(c.author) ? (
            <span className="text-caption text-yellow line-clamp-1">✍️ {c.author}</span>
          ) : (
            c.extract && (
              <span className="text-label-secondary text-footnote line-clamp-1 font-normal">
                {c.extract}
              </span>
            )
          )}
        </div>
      </TableCell>
      <TableCell className="px-4">
        {c.wikiSource === "iiwiki" ? (
          <IIWikiBadge size="xs" />
        ) : (
          <Badge variant="default">{c.wikiSource}</Badge>
        )}
      </TableCell>
      <TableCell className="px-4">
        <Badge variant="secondary">{c.targetRarity}</Badge>
      </TableCell>
      <TableCell className="text-label-secondary px-4">S{c.season}</TableCell>
      <TableCell className="px-4 whitespace-normal">
        <StatusCell candidate={c} onShowError={onShowError} />
      </TableCell>
      <TableCell className="px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {c.status === "error" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Retry import"
              type="button"
              onClick={() => onRetry(c.id)}
              disabled={isBusy}
              title="Retry import"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {artwork && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Inspect artwork"
              type="button"
              onClick={preview}
              title="Inspect artwork"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove candidate"
            type="button"
            onClick={() => onRemove(c.id)}
            title="Remove candidate"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CandidateQueueCard({
  queue,
  duplicateCount,
  onPreview,
  onShowError,
  onPurgeDuplicates,
  onBackfillAuthors,
  onReclassify,
}: CandidateQueueCardProps) {
  const { candidates, counts, isProcessingBatch } = queue;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const visible =
    statusFilter === "ALL" ? candidates : candidates.filter((c) => c.status === statusFilter);

  return (
    <Card className="space-y-3 overflow-hidden p-4">
      <div className="border-separator flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="text-purple h-4 w-4" />
          <span className="text-label text-caption">
            Batch Candidates Queue ({candidates.length})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={queue.deduplicateQueue}
            disabled={isProcessingBatch || candidates.length <= 1}
            title="Remove duplicate articles currently in this queue"
          >
            <Layers className="text-purple mr-1 h-3.5 w-3.5" /> Deduplicate queue
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onPurgeDuplicates}
            disabled={isProcessingBatch}
            title="Scan and purge duplicate cards from the database"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge DB Duplicates ({duplicateCount})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onBackfillAuthors}
            disabled={isProcessingBatch}
            title="Backfill page creator and contributor attribution for existing lore cards"
          >
            <Sparkles className="text-yellow mr-1 h-3.5 w-3.5" /> Backfill wiki authors
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onReclassify}
            disabled={isProcessingBatch}
            title="Re-scan and categorize lore cards with multi-signal infobox & category tree classifier"
          >
            <Layers className="text-purple mr-1 h-3.5 w-3.5" /> Re-Catalog Categories
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={queue.clearAll}
            disabled={isProcessingBatch}
            className="text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={queue.processBatch}
            disabled={isProcessingBatch || counts.idle === 0}
          >
            {isProcessingBatch ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating Batch...
              </>
            ) : (
              <>
                <Play className="mr-2 h-3.5 w-3.5" />
                Mint Batch Lore Cards ({counts.idle})
              </>
            )}
          </Button>
        </div>
      </div>

      <SegmentedControl
        size="sm"
        aria-label="Queue status"
        className="mt-1"
        value={statusFilter}
        onValueChange={setStatusFilter}
        options={[
          { value: "ALL", label: `All (${candidates.length})` },
          { value: "idle", label: `Queued (${counts.idle})` },
          { value: "generating", label: `Generating (${counts.generating})` },
          { value: "success", label: `Minted (${counts.success})` },
          ...(counts.error > 0
            ? [{ value: "error" as const, label: `Failed (${counts.error})` }]
            : []),
        ]}
      />

      {counts.error > 0 && (
        <div className="rounded-row border-red/30 bg-red/10 text-footnote flex flex-col justify-between gap-3 border p-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-red mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-red font-semibold">
                {counts.error} candidate{counts.error > 1 ? "s" : ""} failed during generation
              </div>
              <div className="text-label-secondary text-footnote mt-0.5">
                Common issues: Article missing on wiki, stub/short article, duplicate card, or API
                timeout.
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={queue.copyErrorReport}
              className="text-destructive"
            >
              <Copy className="mr-1 h-3 w-3" /> Copy error log
            </Button>
            <Button size="sm" variant="outline" onClick={queue.clearFailed}>
              <Trash2 className="mr-1 h-3 w-3" /> Clear failed
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={queue.retryAllFailed}
              disabled={isProcessingBatch}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Retry All Failed ({counts.error})
            </Button>
          </div>
        </div>
      )}

      <Table containerClassName="max-h-[440px]">
        <TableHeader sticky>
          <TableRow>
            {TABLE_COLUMNS.map(([name, className]) => (
              <TableHead key={name} className={className}>
                {name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              isBusy={isProcessingBatch}
              onPreview={onPreview}
              onShowError={onShowError}
              onRetry={queue.retryCandidate}
              onRemove={queue.removeCandidate}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
