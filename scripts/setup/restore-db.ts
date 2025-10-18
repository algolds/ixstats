#!/usr/bin/env tsx

/**
 * Database restore script for IxStats
 * Restores database from a backup file
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

async function restoreDatabase() {
  try {
    console.log("🔄 Restoring database from backup...");
    
    // Check if we're in production
    if (process.env.NODE_ENV === 'production') {
      console.error("❌ Database restore is disabled in production environment");
      process.exit(1);
    }
    
    // Get backup file from command line argument or list available backups
    const backupFile = process.argv[2];
    const backupDir = './prisma/backups';
    
    if (!backupFile) {
      console.log("📋 Available backups:");
      if (!existsSync(backupDir)) {
        console.log("  No backup directory found");
        process.exit(1);
      }
      
      const backups = readdirSync(backupDir)
        .filter((file: string) => file.startsWith('backup_') && file.endsWith('.db'))
        .sort()
        .reverse();
      
      if (backups.length === 0) {
        console.log("  No backups found");
        process.exit(1);
      }
      
      backups.forEach((backup: string, index: number) => {
        console.log(`  ${index + 1}. ${backup}`);
      });
      
      console.log("\n💡 Usage: npm run db:restore -- <backup-filename>");
      console.log("💡 Example: npm run db:restore -- backup_2024-01-15T10-30-00.db");
      process.exit(0);
    }
    
    // Validate backup file
    const backupPath = join(backupDir, backupFile);
    if (!existsSync(backupPath)) {
      console.error(`❌ Backup file not found: ${backupPath}`);
      process.exit(1);
    }
    
    // Determine target database path
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
    
    // Create backup of current database before restore
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const currentBackupPath = join(backupDir, `pre-restore_${timestamp}.db`);
    
    if (existsSync(dbPath)) {
      execSync(`cp "${dbPath}" "${currentBackupPath}"`, { stdio: 'inherit' });
      console.log(`💾 Current database backed up to: ${currentBackupPath}`);
    }
    
    // Restore from backup
    if (dbPath.endsWith('.db')) {
      // SQLite database
      execSync(`cp "${backupPath}" "${dbPath}"`, { stdio: 'inherit' });
      console.log(`✅ Database restored from: ${backupFile}`);
    } else {
      // PostgreSQL or other database
      console.log("⚠️  PostgreSQL restore not implemented yet");
      console.log("💡 Use psql for PostgreSQL restores");
      process.exit(1);
    }
    
    // Verify restore
    const countryCount = await db.country.count();
    const userCount = await db.user.count();
    console.log(`📊 Restored database contains: ${countryCount} countries, ${userCount} users`);
    
    console.log("✅ Database restore complete!");
    
  } catch (error) {
    console.error("❌ Database restore failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  restoreDatabase();
}
