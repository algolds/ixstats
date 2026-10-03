"use client";

import { useState } from "react";
import { OpenBook as BookOpen, UserBadgeCheck as UserCheck } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { BatchControls } from "./lore-batch/BatchControls";
import { CandidateQueueCard } from "./lore-batch/CandidateQueueCard";
import { CATEGORY_PRESETS } from "./lore-batch/category-presets";
import {
  ArtworkPreviewDialog,
  BackfillAuthorsDialog,
  ErrorDiagnosticsDialog,
  PurgeDuplicatesDialog,
  ReclassifyDialog,
} from "./lore-batch/LoreBatchDialogs";
import { RequestQueueTab } from "./lore-batch/RequestQueueTab";
import type { ArtworkPreview, BatchCandidate } from "./lore-batch/types";
import { useLoreBatchLoaders } from "./lore-batch/useLoreBatchLoaders";
import { useLoreBatchQueue } from "./lore-batch/useLoreBatchQueue";

export { CATEGORY_PRESETS };

/** Lore card batch generator (wiki crawls, presets, bulk import) and the user request queue. */
export function LoreCardBatchAdmin() {
  const [activeTab, setActiveTab] = useState<"generator" | "requests">("generator");
  const [preview, setPreview] = useState<ArtworkPreview | null>(null);
  const [errorCandidate, setErrorCandidate] = useState<BatchCandidate | null>(null);
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [isReclassifyOpen, setIsReclassifyOpen] = useState(false);

  const queue = useLoreBatchQueue();
  const loaders = useLoreBatchLoaders(queue);
  const { data: duplicateStats, refetch: refetchDuplicates } =
    api.loreCards.getDuplicateCardsStats.useQuery();
  const requestStats = api.loreCards.getRequestStats.useQuery(undefined, {
    enabled: activeTab === "requests",
  });

  return (
    <Card className="space-y-6 p-6">
      <div className="border-separator flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-purple/30 bg-purple/10 border p-3">
            <BookOpen className="text-purple h-5 w-5" />
          </div>
          <div>
            <h2 className="text-label text-title-2">Lore card batch studio & requests</h2>
            <p className="text-label-secondary text-caption">
              AI wiki card generation, category preset crawlers, CSV/JSON bulk import, and request
              queue.
            </p>
          </div>
        </div>

        <SegmentedControl
          asTabs
          aria-label="Lore batch views"
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            {
              value: "generator",
              label: `Batch Studio (${queue.candidates.length})`,
              icon: <BookOpen />,
            },
            {
              value: "requests",
              label: `User Queue (${requestStats.data?.pending ?? 0})`,
              icon: <UserCheck />,
            },
          ]}
        />
      </div>

      {activeTab === "generator" && (
        <div className="space-y-6">
          <BatchControls queue={queue} loaders={loaders} />
          {queue.candidates.length > 0 && (
            <CandidateQueueCard
              queue={queue}
              duplicateCount={duplicateStats?.totalDuplicates ?? 0}
              onPreview={setPreview}
              onShowError={setErrorCandidate}
              onPurgeDuplicates={() => setIsPurgeOpen(true)}
              onBackfillAuthors={() => setIsBackfillOpen(true)}
              onReclassify={() => setIsReclassifyOpen(true)}
            />
          )}
        </div>
      )}
      {activeTab === "requests" && <RequestQueueTab />}

      <ArtworkPreviewDialog preview={preview} onClose={() => setPreview(null)} />
      <PurgeDuplicatesDialog
        open={isPurgeOpen}
        onOpenChange={setIsPurgeOpen}
        stats={duplicateStats}
        onPurged={() => void refetchDuplicates()}
      />
      <BackfillAuthorsDialog open={isBackfillOpen} onOpenChange={setIsBackfillOpen} />
      <ReclassifyDialog open={isReclassifyOpen} onOpenChange={setIsReclassifyOpen} />
      <ErrorDiagnosticsDialog
        candidate={errorCandidate}
        isBusy={queue.isProcessingBatch}
        onClose={() => setErrorCandidate(null)}
        onRetry={(id) => void queue.retryCandidate(id)}
      />
    </Card>
  );
}
