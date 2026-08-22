/**
 * index.ts — Universal MediaWiki Ingestion & Migration Engine
 */

export interface MigrationOptions {
  sourceDumpPath: string;
  realm?: string;
  dryRun?: boolean;
  batchSize?: number;
  limit?: number;
}

export interface MigrationProgress {
  pagesProcessed: number;
  revisionsImported: number;
  linksIndexed: number;
  categoriesCreated: number;
  status: "idle" | "running" | "completed" | "error";
  error?: string;
}
