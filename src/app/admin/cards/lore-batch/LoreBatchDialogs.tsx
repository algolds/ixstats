"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  CheckCircle as CheckCircle2,
  Component as Layers,
  Copy,
  InfoCircle as Info,
  MediaImage as ImageIcon,
  OpenNewWindow as ExternalLink,
  Sparks as Sparkles,
  SystemRestart as Loader2,
  Trash as Trash2,
  Undo as RotateCcw,
  WarningCircle as AlertCircle,
  WarningTriangle as AlertTriangle,
  XmarkCircle as XCircle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils";
import { publicArticleUrl } from "~/lib/wiki-os/config";
import type { ArtworkPreview, BatchCandidate } from "./types";

type Tone = "red" | "yellow" | "purple";

const TONE_BOX: Record<Tone, string> = {
  red: "border-red/30 bg-red/10",
  yellow: "border-yellow/30 bg-yellow/10",
  purple: "border-purple/30 bg-purple/10",
};
const TONE_ICON: Record<Tone, string> = {
  red: "text-red",
  yellow: "text-yellow",
  purple: "text-purple",
};

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "ixwiki", label: "IxWiki" },
  { value: "iiwiki", label: "IIWiki" },
] as const;

const LIMIT_OPTIONS = [50, 100, 250, 500].map((num) => ({
  value: String(num),
  label: `${num} Cards`,
}));

type SourceFilter = (typeof SOURCE_OPTIONS)[number]["value"];

interface ToneHeaderProps {
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  title: ReactNode;
  description: string;
}

function ToneHeader({ icon: Icon, tone, title, description }: ToneHeaderProps) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-3">
        <div className={cn("rounded-row border p-3", TONE_BOX[tone])}>
          <Icon className={cn("h-5 w-5", TONE_ICON[tone])} />
        </div>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );
}

function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
      <label className="text-label text-caption block">{label}</label>
      {children}
    </div>
  );
}

export function ArtworkPreviewDialog({
  preview,
  onClose,
}: {
  preview: ArtworkPreview | null;
  onClose: () => void;
}) {
  const notify = useNotify();
  return (
    <Dialog open={!!preview} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        {preview && (
          <div>
            <div className="border-separator flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-row border-purple/30 bg-purple/10 border p-2">
                  <Sparkles className="text-purple h-4 w-4" />
                </div>
                <div>
                  <DialogTitle>{preview.title}</DialogTitle>
                  <DialogDescription>Parsed wiki artwork & media inspector</DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {preview.wikiSource && (
                  <Badge variant="default" className="tabular-nums">
                    {preview.wikiSource}
                  </Badge>
                )}
                {preview.rarity && <Badge variant="secondary">{preview.rarity}</Badge>}
              </div>
            </div>

            <div className="border-separator relative flex max-h-[480px] min-h-[300px] w-full items-center justify-center border-b bg-black/60 p-4">
              {preview.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt={preview.title}
                  className="rounded-row duration-fast max-h-[420px] w-auto max-w-full object-contain transition-transform"
                />
              ) : (
                <div className="text-label-secondary flex flex-col items-center justify-center py-12">
                  <ImageIcon className="mb-2 h-12 w-12 stroke-[1.5] opacity-50" />
                  <p className="text-footnote">No primary artwork detected for this article</p>
                </div>
              )}
            </div>

            <div className="space-y-3 p-6">
              {preview.extract && (
                <div className="bg-surface border-separator text-label-secondary rounded-row text-footnote max-h-24 overflow-y-auto border p-3 leading-relaxed">
                  <p className="text-label text-caption mb-1">Article Summary:</p>
                  {preview.extract}
                </div>
              )}

              {preview.imageUrl && (
                <div className="bg-fill-3 border-separator rounded-row text-footnote flex items-center justify-between border px-3 py-2 font-mono">
                  <span className="text-label-secondary max-w-[400px] truncate">
                    {preview.imageUrl}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(preview.imageUrl);
                      notify.success("Copied", "Image URL copied to clipboard.");
                    }}
                    className="ml-2 h-auto shrink-0 gap-1 px-0 font-sans"
                  >
                    <Copy aria-hidden className="size-3.5" /> Copy URL
                  </Button>
                </div>
              )}
            </div>

            <div className="border-separator bg-surface flex items-center justify-between border-t px-6 py-4">
              {preview.wikiSource ? (
                <a
                  href={publicArticleUrl(
                    preview.title,
                    preview.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki"
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="text-tint text-caption inline-flex items-center gap-2 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View wiki article
                </a>
              ) : (
                <div />
              )}
              <Button size="sm" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DuplicateStats {
  totalDuplicates: number;
  loreGroups: Array<{ title: string; wikiSource: string; count: number; redundantCount: number }>;
}

/** Refreshes the audit log and lore stats the maintenance dialogs change. */
function useRefreshLoreStats() {
  const utils = api.useUtils();
  return () => {
    void utils.cards.getUnifiedAuditLogs.invalidate();
    void utils.cards.getLoreStats.invalidate();
  };
}

export function PurgeDuplicatesDialog({
  open,
  onOpenChange,
  stats,
  onPurged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: DuplicateStats | undefined;
  onPurged: () => void;
}) {
  const notify = useNotify();
  const refreshStats = useRefreshLoreStats();
  const total = stats?.totalDuplicates ?? 0;
  const purge = api.loreCards.purgeDuplicateCards.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Duplicates Purged", data.message);
      onOpenChange(false);
      onPurged();
      refreshStats();
    },
    onError: (err: { message: string }) => notify.error("Purge Error", err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <ToneHeader
          icon={Trash2}
          tone="red"
          title={`Purge Duplicate Cards (${total} Redundant)`}
          description="Safely consolidate duplicate cards and clean up redundant database copies."
        />

        <div className="text-footnote space-y-4 py-2">
          <div className="rounded-row border-yellow/30 bg-yellow/10 text-yellow space-y-1 border p-4">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              How Duplicate Purging Works:
            </p>
            <p className="text-footnote leading-relaxed opacity-90">
              For each article with duplicate cards, the system selects the highest-level / most
              referenced card as the Primary Keeper. All user ownerships, auctions, and value
              history are re-linked to the keeper card before deleting redundant copies.
            </p>
          </div>

          {stats?.loreGroups && stats.loreGroups.length > 0 ? (
            <div className="space-y-2">
              <span className="text-label block font-semibold">
                Duplicate Groups ({stats.loreGroups.length} unique articles):
              </span>
              <div className="border-separator bg-surface divide-separator rounded-row max-h-52 divide-y overflow-y-auto border">
                {stats.loreGroups.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="text-label truncate font-semibold">{g.title}</p>
                      <span className="text-label-secondary text-eyebrow tabular-nums">
                        {g.wikiSource}
                      </span>
                    </div>
                    <Badge variant="destructive">
                      {g.count} copies (+{g.redundantCount} redundant)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-label-secondary py-4 text-center">
              <CheckCircle2 className="text-green mx-auto mb-2 h-8 w-8 opacity-80" />
              <p className="text-label font-semibold">No duplicate lore cards found</p>
              <p className="text-footnote">
                Your database is clean with no redundant lore card records.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={purge.isPending || total === 0}
            onClick={() => purge.mutate({ mode: "wiki_lore" })}
          >
            {purge.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Purging...
              </>
            ) : (
              <>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge {total} Duplicates
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BatchJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  header: ToneHeaderProps;
  source: SourceFilter;
  onSourceChange: (source: SourceFilter) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  /** Extra controls between the limit selector and the summary. */
  extra?: ReactNode;
  summary: ReactNode;
  isPending: boolean;
  startLabel: ReactNode;
  pendingLabel: string;
  onStart: () => void;
}

/** The source + batch-limit form both bulk lore-card maintenance jobs share. */
function BatchJobDialog(props: BatchJobDialogProps) {
  const { source, limit } = props;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={cn("max-w-md", props.className)}>
        <ToneHeader {...props.header} />
        <div className="text-footnote space-y-4 py-2">
          <FieldBox label="Wiki Source:">
            <SegmentedControl
              size="sm"
              fullWidth
              aria-label="Wiki source"
              value={source}
              onValueChange={props.onSourceChange}
              options={SOURCE_OPTIONS}
            />
          </FieldBox>
          <FieldBox label="Batch Limit:">
            <SegmentedControl
              size="sm"
              fullWidth
              aria-label="Batch limit"
              value={String(limit)}
              onValueChange={(value) => props.onLimitChange(Number(value))}
              options={LIMIT_OPTIONS}
            />
          </FieldBox>
          {props.extra}
          <p className="text-label-secondary text-footnote leading-relaxed">{props.summary}</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={props.isPending} onClick={props.onStart}>
            {props.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> {props.pendingLabel}
              </>
            ) : (
              props.startLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const sourceName = (source: SourceFilter) =>
  source === "all" ? "all wikis" : source.toUpperCase();

type JobDialogProps = Pick<BatchJobDialogProps, "open" | "onOpenChange">;

export function BackfillAuthorsDialog(props: JobDialogProps) {
  const notify = useNotify();
  const refreshStats = useRefreshLoreStats();
  const [limit, setLimit] = useState(100);
  const [source, setSource] = useState<SourceFilter>("all");
  const backfill = api.loreCards.backfillWikiAuthors.useMutation({
    onSuccess: (data: { count: number; message: string }) => {
      notify.success("Authors Backfilled", data.message);
      props.onOpenChange(false);
      refreshStats();
    },
    onError: (err: { message: string }) => notify.error("Backfill Error", err.message),
  });

  return (
    <BatchJobDialog
      {...props}
      header={{
        icon: Sparkles,
        tone: "yellow",
        title: "Backfill wiki authors",
        description:
          "Query MediaWiki API to parse and store creator & top contributor attribution on lore cards.",
      }}
      source={source}
      onSourceChange={setSource}
      limit={limit}
      onLimitChange={setLimit}
      summary={
        <>
          This will find lore cards from{" "}
          <strong className="text-label">{sourceName(source)}</strong> without saved{" "}
          <code className="rounded-control-sm bg-yellow/10 text-yellow px-1 py-0.5 tabular-nums">
            authorInfo
          </code>
          , fetch their revision history to locate human page creators and top editors, and persist
          the attribution to the database.
        </>
      }
      isPending={backfill.isPending}
      pendingLabel="Backfilling..."
      startLabel={
        <>
          <Sparkles className="mr-2 h-3.5 w-3.5" /> Start Backfill ({limit})
        </>
      }
      onStart={() => backfill.mutate({ limit, wikiSource: source })}
    />
  );
}

export function ReclassifyDialog(props: JobDialogProps) {
  const notify = useNotify();
  const refreshStats = useRefreshLoreStats();
  const [limit, setLimit] = useState(100);
  const [source, setSource] = useState<SourceFilter>("all");
  const [force, setForce] = useState(false);
  const reclassify = api.loreCards.reclassifyLoreCards.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Categories Re-Cataloged", data.message);
      props.onOpenChange(false);
      refreshStats();
    },
    onError: (err: { message: string }) => notify.error("Re-Catalog Error", err.message),
  });

  return (
    <BatchJobDialog
      {...props}
      className="space-y-4 p-6"
      header={{
        icon: Layers,
        tone: "purple",
        title: "Re-Catalog Lore Categories",
        description:
          "Re-evaluate existing lore cards using Infobox template and category tree scoring.",
      }}
      source={source}
      onSourceChange={setSource}
      limit={limit}
      onLimitChange={setLimit}
      extra={
        <div className="border-separator bg-fill-4 rounded-row flex items-center justify-between border p-3">
          <div>
            <span id="reclassify-force-label" className="text-label text-caption block">
              Force overwrite
            </span>
            <span id="reclassify-force-hint" className="text-label-secondary text-footnote">
              Re-classify all cards, not just unclassified/defaults
            </span>
          </div>
          <Checkbox
            aria-labelledby="reclassify-force-label"
            aria-describedby="reclassify-force-hint"
            checked={force}
            onCheckedChange={(checked) => setForce(checked === true)}
          />
        </div>
      }
      summary={
        <>
          This will analyze lore cards from{" "}
          <strong className="text-label">{sourceName(source)}</strong> against the 12 canonical
          LoreCategory enums, matching infobox types (e.g. officeholders, treaties, battles,
          settlements) and persisting accurate category seals.
        </>
      }
      isPending={reclassify.isPending}
      pendingLabel="Classifying..."
      startLabel={
        <>
          <Layers className="mr-2 h-3.5 w-3.5" /> Start Re-Catalog ({limit})
        </>
      }
      onStart={() => reclassify.mutate({ limit, wikiSource: source, forceOverwrite: force })}
    />
  );
}

export function ErrorDiagnosticsDialog({
  candidate,
  isBusy,
  onClose,
  onRetry,
}: {
  candidate: BatchCandidate | null;
  isBusy: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
}) {
  return (
    <Dialog open={!!candidate} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md space-y-4 p-6">
        <ToneHeader
          icon={AlertTriangle}
          tone="red"
          title="Import failure diagnostics"
          description="Troubleshooting details for why this lore card failed to generate."
        />

        {candidate && (
          <div className="text-footnote space-y-3 py-1">
            <div className="border-separator bg-fill-3 rounded-row space-y-2 border p-3">
              {(
                [
                  ["Article Title:", candidate.articleTitle, "text-label"],
                  ["Wiki Source:", candidate.wikiSource, "text-label"],
                  ["Target Rarity:", candidate.targetRarity, "text-purple"],
                ] as const
              ).map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-label-secondary font-medium">{label}</span>
                  <span className={cn("font-semibold", tone)}>{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-row border-red/30 bg-red/10 space-y-2 border p-3">
              <div className="text-caption text-red flex items-center gap-2">
                <XCircle className="text-red h-4 w-4" /> Error reason
              </div>
              <div className="text-footnote text-red leading-relaxed break-words whitespace-pre-wrap tabular-nums">
                {candidate.errorMessage || "Unknown error occurred during generation."}
              </div>
            </div>

            <div className="border-separator bg-surface text-label-secondary rounded-row text-footnote space-y-1 border p-3">
              <div className="text-label flex items-center gap-1 font-semibold">
                <Info className="text-tint h-3.5 w-3.5" /> Troubleshooting Tips:
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  Verify article spelling, casing, and underscores on{" "}
                  {candidate.wikiSource.toUpperCase()}.
                </li>
                <li>
                  Ensure the article has sufficient prose content (not an empty stub or redirect).
                </li>
                <li>Check if a card for this article title already exists in the database.</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {candidate && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onRetry(candidate.id);
              }}
              disabled={isBusy}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry import now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
