#!/usr/bin/env bun

/**
 * Database restore script for IxStats (PL-11)
 * Restores a pg_dump custom-format dump with pg_restore --clean --if-exists --no-owner.
 *
 *   bun run db:restore                     # list backups in backups/
 *   bun run db:restore -- <file>           # print what would be restored, and where
 *   bun run db:restore -- <file> --yes     # restore
 *
 * Restores into the `ixstats-postgres` Docker container when it is running, else into DATABASE_URL
 * (`--no-docker` forces DATABASE_URL). Refused under NODE_ENV=production unless
 * --i-know-this-is-production is also passed. See docs/operations/deployment.md.
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import {
  DEFAULT_BACKUP_DIR,
  describeTarget,
  isBackupFileName,
  parseRestoreArgs,
  resolveTarget,
  restoreCommand,
  restoreDatabaseBackup,
  restoreRefusal,
} from "~/lib/system/db-backup";

function listBackups() {
  console.log(`📋 Backups in ${DEFAULT_BACKUP_DIR}/ (oldest first):`);
  const files = existsSync(DEFAULT_BACKUP_DIR) ? readdirSync(DEFAULT_BACKUP_DIR) : [];
  const backups = files.filter(isBackupFileName).sort();
  if (backups.length === 0) console.log("  No backups found");
  for (const name of backups) console.log(`  ${name}`);
  console.log("\n💡 Usage: bun run db:restore -- <backup-file> [--yes]");
}

async function restoreDatabase() {
  try {
    const args = parseRestoreArgs(process.argv.slice(2));
    if (!args.file) {
      listBackups();
      return;
    }

    const refusal = restoreRefusal(args, process.env.NODE_ENV);
    if (refusal) {
      console.error(`❌ ${refusal}`);
      process.exit(1);
    }

    const file = existsSync(args.file) ? args.file : join(DEFAULT_BACKUP_DIR, args.file);
    if (!existsSync(file)) {
      console.error(`❌ Backup file not found: ${args.file}`);
      process.exit(1);
    }

    const target = resolveTarget({
      noDocker: args.noDocker,
      databaseUrl: process.env.DATABASE_URL,
    });
    const spec = restoreCommand(target, file);
    const input = spec.stdin ? ` < ${spec.stdin}` : "";
    console.log(`🔄 Restore ${file}`);
    console.log(`   into ${describeTarget(target)}`);
    console.log(`   with ${spec.command} ${spec.args.join(" ")}${input}`);
    console.log("   Objects in the dump are dropped and recreated (--clean --if-exists).");

    if (!args.yes) {
      console.log("\n💡 Nothing was changed. Re-run with --yes to restore.");
      return;
    }

    await restoreDatabaseBackup(target, file);
    console.log("✅ Database restore complete!");
  } catch (error) {
    console.error("❌ Database restore failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void restoreDatabase();
