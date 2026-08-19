// src/lib/wiki-os/sync-queue.ts
// Client-side persistent background sync queue for WikiOS visual & source editors.
// Enables 0ms perceived save latency with resilient offline queueing & auto-retry.

export interface SyncQueueItem {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly html?: string;
  readonly wikitext?: string;
  readonly summary: string;
  readonly minor: boolean;
  readonly basetimestamp?: string;
  readonly mode: "visual" | "source";
  readonly createdAt: number;
  status: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  lastError?: string;
}

export type SyncListener = (items: readonly SyncQueueItem[]) => void;

const QUEUE_STORAGE_KEY = "wikios_sync_queue_v1";
const listeners = new Set<SyncListener>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function loadQueue(): SyncQueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueueItem[];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncQueueItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifyListeners(queue);
  } catch (err) {
    console.warn("[WikiSyncQueue] Failed to save queue:", err);
  }
}

function notifyListeners(queue: SyncQueueItem[]): void {
  for (const listener of listeners) {
    try {
      listener(queue);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Subscribe to sync queue state changes (e.g. for header sync indicator).
 */
export function subscribeSyncQueue(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(loadQueue());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Enqueue an article save action for background processing.
 */
export function enqueueSave(
  item: Omit<SyncQueueItem, "id" | "createdAt" | "status" | "retryCount">
): SyncQueueItem {
  const queue = loadQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: `${item.source}:${item.title}:${Date.now()}`,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  // Replace any pending save for the exact same page
  const filtered = queue.filter(
    (q) => !(q.title === item.title && q.source === item.source && q.status === "pending")
  );
  filtered.push(newItem);
  saveQueue(filtered);

  return newItem;
}

/**
 * Mark a queue item as actively syncing or completed/failed.
 */
export function updateQueueItemStatus(
  id: string,
  status: SyncQueueItem["status"],
  error?: string
): void {
  const queue = loadQueue();
  const item = queue.find((q) => q.id === id);
  if (!item) return;

  item.status = status;
  if (error) item.lastError = error;
  if (status === "syncing") item.retryCount++;

  if (status === "synced") {
    // Retain only un-synced items or recent synced items (<5 min)
    const pruneThreshold = Date.now() - 5 * 60 * 1000;
    const pruned = queue.filter((q) => q.id !== id || q.createdAt > pruneThreshold);
    saveQueue(pruned);
  } else {
    saveQueue(queue);
  }
}

/**
 * Remove a specific item from the sync queue.
 */
export function removeFromQueue(id: string): void {
  const queue = loadQueue();
  saveQueue(queue.filter((q) => q.id !== id));
}

/**
 * Get all pending/syncing items in the queue.
 */
export function getPendingQueue(): SyncQueueItem[] {
  return loadQueue().filter((q) => q.status === "pending" || q.status === "syncing");
}
