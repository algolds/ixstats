#!/usr/bin/env bun

/**
 * Database backup script for IxStats (PL-11)
 * Writes a pg_dump custom-format dump to backups/ixstats-<UTC timestamp>.dump, keeping the newest N.
 *
 *   bun run db:backup [-- --keep 14] [--dir backups] [--no-docker]
 *
 * Dumps from the `ixstats-postgres` Docker container when it is running, else from DATABASE_URL
 * (needs pg_dump on the host). Exits non-zero on any failure. See docs/operations/deployment.md.
 */

import { createDatabaseBackup, parseBackupArgs } from "~/lib/system/db-backup";

async function backupDatabase() {
  try {
    const args = parseBackupArgs(process.argv.slice(2));
    console.log("💾 Creating database backup...");
    const result = await createDatabaseBackup(args);
    const mb = (result.bytes / 1024 / 1024).toFixed(1);
    console.log(`✅ Backup written (${result.target}): ${result.file} (${mb} MB)`);
    for (const name of result.pruned) console.log(`🧹 Removed old backup: ${name}`);
    console.log(`📦 Retention: newest ${args.keep} backups kept in ${args.dir}/`);
  } catch (error) {
    console.error("❌ Database backup failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void backupDatabase();
