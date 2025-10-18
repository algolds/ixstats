#!/usr/bin/env tsx

/**
 * Database backup script for IxStats
 * Creates timestamped backups of the database
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

async function backupDatabase() {
  try {
    console.log("💾 Creating database backup...");
    
    // Determine database path
    let dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db';
    
    // If path doesn't start with ./, make it relative to current directory
    if (!dbPath.startsWith('./') && !dbPath.startsWith('/')) {
      dbPath = './' + dbPath;
    }
    
    // If the file doesn't exist, try the prisma directory
    if (!existsSync(dbPath) && !dbPath.includes('prisma/')) {
      const prismaPath = './prisma/' + dbPath.replace('./', '');
      if (existsSync(prismaPath)) {
        dbPath = prismaPath;
      }
    }
    
    // Ensure the path is absolute and exists
    if (!existsSync(dbPath)) {
      console.error(`❌ Database file not found: ${dbPath}`);
      console.log("💡 Available database files:");
      try {
        const files = readdirSync('./prisma').filter((file: string) => file.endsWith('.db'));
        files.forEach((file: string) => console.log(`  - ./prisma/${file}`));
      } catch (e) {
        console.log("  No database files found in ./prisma/");
      }
      process.exit(1);
    }
    const backupDir = './prisma/backups';
    
    // Create backup directory if it doesn't exist
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    
    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = join(backupDir, `backup_${timestamp}.db`);
    
    // Create backup using SQLite command
    if (dbPath.endsWith('.db')) {
      // SQLite database
      execSync(`cp "${dbPath}" "${backupPath}"`, { stdio: 'inherit' });
      console.log(`✅ SQLite backup created: ${backupPath}`);
    } else {
      // PostgreSQL or other database
      console.log("⚠️  PostgreSQL backup not implemented yet");
      console.log("💡 Use pg_dump for PostgreSQL backups");
      process.exit(1);
    }
    
    // Get backup size
    const stats = statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Backup size: ${sizeMB} MB`);
    
    // List recent backups
    console.log("\n📋 Recent backups:");
    const backups = readdirSync(backupDir)
      .filter((file: string) => file.startsWith('backup_') && file.endsWith('.db'))
      .sort()
      .slice(-5);
    
    backups.forEach((backup: string) => {
      console.log(`  - ${backup}`);
    });
    
  } catch (error) {
    console.error("❌ Database backup failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backupDatabase();
}
