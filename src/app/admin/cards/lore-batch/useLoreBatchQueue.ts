import { useMemo, useState } from "react";
import type { CardRarity } from "@prisma/client";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { BatchCandidate, WikiSource } from "./types";

export type CandidateSeed = Partial<BatchCandidate> & Pick<BatchCandidate, "articleTitle">;

export const errorMessageOf = (err: unknown, fallback: string) =>
  (err instanceof Error && err.message) || fallback;

/** State and actions of the lore card batch studio: the candidate queue and its loaders. */
export function useLoreBatchQueue() {
  const notify = useNotify();
  const utils = api.useUtils();

  const [wikiSource, setWikiSource] = useState<WikiSource>("ixwiki");
  const [targetRarity, setTargetRarity] = useState<CardRarity | "AUTO">("AUTO");
  const [season, setSeason] = useState(1);
  const [candidates, setCandidates] = useState<BatchCandidate[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const generateCardMutation = api.loreCards.generateLoreCard.useMutation();

  const counts = useMemo(() => {
    const tally = { idle: 0, generating: 0, success: 0, error: 0 };
    for (const c of candidates) tally[c.status]++;
    return tally;
  }, [candidates]);

  const patchCandidate = (id: string, patch: Partial<BatchCandidate>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const enrichThumbnails = async (items: BatchCandidate[]) => {
    const titles = items.filter((c) => !c.imageUrl).map((c) => c.articleTitle);
    if (titles.length === 0) return;
    try {
      const res = await utils.loreCards.fetchArticlePreviewsBatch.fetch({
        titles: titles.slice(0, 100),
        source: wikiSource,
      });
      const previews = new Map(res.previews.map((p) => [p.title.toLowerCase(), p]));
      if (previews.size === 0) return;
      setCandidates((prev) =>
        prev.map((c) => {
          const p = previews.get(c.articleTitle.toLowerCase());
          if (!p) return c;
          return {
            ...c,
            imageUrl: p.imageUrl || c.imageUrl || null,
            extract: p.extract || c.extract,
            category: c.category || p.category,
            authorInfo: p.authorInfo || null,
            author: p.authorInfo?.displayAuthor,
          };
        })
      );
    } catch (e) {
      console.warn("Thumbnail enrichment failed:", e);
    }
  };

  /** Queues the seeds with the studio's current source, rarity and season as defaults. */
  const addCandidates = (seeds: CandidateSeed[]) => {
    const items: BatchCandidate[] = seeds.map((seed) => ({
      id: crypto.randomUUID(),
      wikiSource,
      targetRarity,
      season,
      status: "idle",
      ...seed,
    }));
    setCandidates((prev) => [...prev, ...items]);
    void enrichThumbnails(items);
    return items.length;
  };

  const exportJson = () => {
    if (candidates.length === 0) return;
    const anchor = document.createElement("a");
    anchor.href =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
    anchor.download = `lore_batch_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    notify.success("Batch Exported", "Exported candidates to JSON.");
  };

  const deduplicateQueue = () => {
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const key = `${c.wikiSource}:${c.articleTitle.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setCandidates(unique);
    const removed = candidates.length - unique.length;
    if (removed > 0) {
      notify.success(
        "Queue Deduplicated",
        `Removed ${removed} redundant duplicate item(s) from candidate queue.`
      );
    } else {
      notify.info("Queue Clean", "No duplicate items found in candidate queue.");
    }
  };

  /** Mints one candidate's card, recording the outcome on it; resolves to the error, if any. */
  const mintCandidate = async (item: BatchCandidate): Promise<string | null> => {
    patchCandidate(item.id, { status: "generating", errorMessage: undefined });
    try {
      const res = await generateCardMutation.mutateAsync({
        articleTitle: item.articleTitle,
        wikiSource: item.wikiSource,
        targetRarity: item.targetRarity !== "AUTO" ? item.targetRarity : undefined,
        customPrompt: item.customPrompt,
      });
      patchCandidate(item.id, {
        status: "success",
        generatedCardId: res.cardId,
        mintedArtwork: item.imageUrl || null,
        errorMessage: undefined,
      });
      return null;
    } catch (err) {
      const message = errorMessageOf(err, "Generation failed");
      patchCandidate(item.id, { status: "error", errorMessage: message });
      return message;
    }
  };

  const retryCandidate = async (id: string) => {
    const item = candidates.find((c) => c.id === id);
    if (!item) return;
    const error = await mintCandidate(item);
    if (error) {
      notify.error("Retry Failed", error);
    } else {
      notify.success("Card Minted", `Successfully minted lore card for "${item.articleTitle}".`);
    }
  };

  const retryAllFailed = () => {
    if (counts.error === 0) {
      notify.info("No Failed Candidates", "There are no failed items in the queue to retry.");
      return;
    }
    setCandidates((prev) =>
      prev.map((c) =>
        c.status === "error" ? { ...c, status: "idle", errorMessage: undefined } : c
      )
    );
    notify.info("Resetting Failed Items", `Reset ${counts.error} candidate(s) to queued status.`);
  };

  const clearFailed = () => {
    setCandidates((prev) => prev.filter((c) => c.status !== "error"));
    notify.info(
      "Failed Candidates Cleared",
      `Removed ${counts.error} failed candidate(s) from the queue.`
    );
  };

  const copyErrorReport = () => {
    const failed = candidates.filter((c) => c.status === "error");
    if (failed.length === 0) {
      notify.info("No Errors", "No failed candidates in the queue.");
      return;
    }
    const report = [
      `# Lore Card Import Failure Report (${new Date().toLocaleString()})`,
      `Total Failures: ${failed.length}`,
      "",
      ...failed.map(
        (c, i) =>
          `${i + 1}. [${c.wikiSource.toUpperCase()}] "${c.articleTitle}" (error: ${c.errorMessage || "Unknown generation error"})`
      ),
    ].join("\n");
    void navigator.clipboard.writeText(report);
    notify.success(
      "Error Report Copied",
      `Copied diagnostic details for ${failed.length} failed articles to clipboard.`
    );
  };

  const processBatch = async () => {
    const queued = candidates.filter((c) => c.status === "idle");
    if (queued.length === 0) {
      notify.info("No Idle Candidates", "Add candidates to the queue or reset failed ones.");
      return;
    }

    setIsProcessingBatch(true);
    let failCount = 0;
    for (const item of queued) {
      if (await mintCandidate(item)) failCount++;
    }
    setIsProcessingBatch(false);

    const mintedCount = queued.length - failCount;
    if (failCount > 0) {
      notify.warning(
        "Batch Completed with Errors",
        `Finished: ${mintedCount} minted, ${failCount} failed. Check the error reasons in the queue.`
      );
    } else {
      notify.success(
        "Batch Process Complete",
        `All ${mintedCount} lore card(s) minted successfully.`
      );
    }
  };

  return {
    wikiSource,
    setWikiSource,
    targetRarity,
    setTargetRarity,
    season,
    setSeason,
    candidates,
    counts,
    isProcessingBatch,
    clearAll: () => setCandidates([]),
    removeCandidate: (id: string) => setCandidates((prev) => prev.filter((c) => c.id !== id)),
    addCandidates,
    exportJson,
    deduplicateQueue,
    retryCandidate,
    retryAllFailed,
    clearFailed,
    copyErrorReport,
    processBatch,
  };
}
