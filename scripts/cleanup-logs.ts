#!/usr/bin/env tsx

/**
 * IxStats Log and Report Cleanup Script
 *
 * This script performs the following cleanup operations:
 * 1. Deletes log files and audit reports older than 3 days
 * 2. Truncates large files (>10,000 lines) to keep only the most recent entries
 * 3. Removes duplicate or redundant audit reports
 * 4. Cleans up temporary files and node_modules logs
 *
 * Usage: npm run cleanup:logs
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, statSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { UserLogger } from "../src/lib/user-logger";

const PROJECT_ROOT = process.cwd();
const REPORTS_DIR = join(PROJECT_ROOT, "scripts/audit/reports");
const MAX_LINES = 10000;
const MAX_AGE_DAYS = 3;

interface CleanupStats {
  deletedFiles: number;
  truncatedFiles: number;
  totalSpaceSaved: number;
  errors: string[];
}

class LogCleanup {
  private stats: CleanupStats = {
    deletedFiles: 0,
    truncatedFiles: 0,
    totalSpaceSaved: 0,
    errors: [],
  };

  async run(): Promise<void> {
    console.log("🧹 Starting IxStats log and report cleanup...\n");

    try {
      // 1. Clean up old audit reports
      await this.cleanupOldReports();

      // 2. Clean up large files
      await this.truncateLargeFiles();

      // 3. Clean up duplicate reports
      await this.removeDuplicateReports();

      // 4. Clean up log files
      await this.cleanupLogFiles();

      // 5. Clean up node_modules logs
      await this.cleanupNodeModulesLogs();

      // 6. Clean up user logs
      await this.cleanupUserLogs();

      // 7. Display summary
      this.displaySummary();
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      this.stats.errors.push(String(error));
    }
  }

  private async cleanupOldReports(): Promise<void> {
    console.log("📊 Cleaning up old audit reports...");

    try {
      const files = readdirSync(REPORTS_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = join(REPORTS_DIR, file);
        const stats = statSync(filePath);

        if (stats.mtime < cutoffDate) {
          const size = stats.size;
          unlinkSync(filePath);
          this.stats.deletedFiles++;
          this.stats.totalSpaceSaved += size;
          console.log(`  🗑️  Deleted old report: ${file} (${this.formatBytes(size)})`);
        }
      }
    } catch (error) {
      this.stats.errors.push(`Failed to cleanup old reports: ${error}`);
    }
  }

  private async truncateLargeFiles(): Promise<void> {
    console.log("📏 Truncating large files...");

    try {
      const files = readdirSync(REPORTS_DIR);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = join(REPORTS_DIR, file);
        const content = readFileSync(filePath, "utf8");
        const lines = content.split("\n");

        if (lines.length > MAX_LINES) {
          const originalSize = content.length;

          // Keep the last MAX_LINES lines
          const truncatedContent = lines.slice(-MAX_LINES).join("\n");
          writeFileSync(filePath, truncatedContent);

          const newSize = truncatedContent.length;
          const spaceSaved = originalSize - newSize;

          this.stats.truncatedFiles++;
          this.stats.totalSpaceSaved += spaceSaved;
          console.log(
            `  ✂️  Truncated ${file}: ${lines.length} → ${MAX_LINES} lines (${this.formatBytes(spaceSaved)} saved)`
          );
        }
      }
    } catch (error) {
      this.stats.errors.push(`Failed to truncate large files: ${error}`);
    }
  }

  private async removeDuplicateReports(): Promise<void> {
    console.log("🔄 Removing duplicate reports...");

    try {
      const files = readdirSync(REPORTS_DIR);
      const fileGroups = new Map<string, string[]>();

      // Group files by type (consolidated, prod-issues, live-wiring)
      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        let type = "other";
        if (file.startsWith("consolidated-")) type = "consolidated";
        else if (file.startsWith("prod-issues-")) type = "prod-issues";
        else if (file.startsWith("live-wiring-report-")) type = "live-wiring";

        if (!fileGroups.has(type)) {
          fileGroups.set(type, []);
        }
        fileGroups.get(type)!.push(file);
      }

      // For each type, keep only the 3 most recent files
      for (const [type, files] of fileGroups) {
        if (files.length <= 3) continue;

        // Sort by modification time (newest first)
        const sortedFiles = files.sort((a, b) => {
          const statA = statSync(join(REPORTS_DIR, a));
          const statB = statSync(join(REPORTS_DIR, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        });

        // Delete older files
        const filesToDelete = sortedFiles.slice(3);
        for (const file of filesToDelete) {
          const filePath = join(REPORTS_DIR, file);
          const size = statSync(filePath).size;
          unlinkSync(filePath);
          this.stats.deletedFiles++;
          this.stats.totalSpaceSaved += size;
          console.log(`  🗑️  Removed duplicate ${type}: ${file} (${this.formatBytes(size)})`);
        }
      }
    } catch (error) {
      this.stats.errors.push(`Failed to remove duplicates: ${error}`);
    }
  }

  private async cleanupLogFiles(): Promise<void> {
    console.log("📝 Cleaning up log files...");

    try {
      // Clean up dev.log if it's too large
      const devLogPath = join(PROJECT_ROOT, "dev.log");
      try {
        const content = readFileSync(devLogPath, "utf8");
        const lines = content.split("\n");

        if (lines.length > MAX_LINES) {
          const originalSize = content.length;
          const truncatedContent = lines.slice(-MAX_LINES).join("\n");
          writeFileSync(devLogPath, truncatedContent);

          const spaceSaved = originalSize - truncatedContent.length;
          this.stats.truncatedFiles++;
          this.stats.totalSpaceSaved += spaceSaved;
          console.log(
            `  ✂️  Truncated dev.log: ${lines.length} → ${MAX_LINES} lines (${this.formatBytes(spaceSaved)} saved)`
          );
        }
      } catch (error) {
        // dev.log might not exist, that's okay
      }

      // Find and clean up other log files
      const logFiles = this.findLogFiles(PROJECT_ROOT);
      for (const logFile of logFiles) {
        try {
          const stats = statSync(logFile);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

          if (stats.mtime < cutoffDate) {
            unlinkSync(logFile);
            this.stats.deletedFiles++;
            this.stats.totalSpaceSaved += stats.size;
            console.log(`  🗑️  Deleted old log: ${logFile} (${this.formatBytes(stats.size)})`);
          }
        } catch (error) {
          // Skip files we can't process
        }
      }
    } catch (error) {
      this.stats.errors.push(`Failed to cleanup log files: ${error}`);
    }
  }

  private async cleanupNodeModulesLogs(): Promise<void> {
    console.log("📦 Cleaning up node_modules logs...");

    try {
      // Find and delete yarn-error.log files in node_modules
      const command = `find ${PROJECT_ROOT}/node_modules -name "yarn-error.log" -type f -delete 2>/dev/null || true`;
      execSync(command, { stdio: "pipe" });

      // Find and delete npm-debug.log files
      const npmCommand = `find ${PROJECT_ROOT}/node_modules -name "npm-debug.log*" -type f -delete 2>/dev/null || true`;
      execSync(npmCommand, { stdio: "pipe" });

      console.log("  🧹 Cleaned up node_modules log files");
    } catch (error) {
      this.stats.errors.push(`Failed to cleanup node_modules logs: ${error}`);
    }
  }

  private findLogFiles(dir: string): string[] {
    const logFiles: string[] = [];

    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
          logFiles.push(...this.findLogFiles(fullPath));
        } else if (stat.isFile() && file.endsWith(".log")) {
          logFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return logFiles;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Clean up user logs
   */
  private async cleanupUserLogs(): Promise<void> {
    console.log("👤 Cleaning up user logs...");

    try {
      await UserLogger.cleanupOldLogs();
      console.log("  🧹 User logs cleanup completed");
    } catch (error) {
      this.stats.errors.push(`Failed to cleanup user logs: ${error}`);
    }
  }

  private displaySummary(): void {
    console.log("\n📊 Cleanup Summary:");
    console.log(`  🗑️  Files deleted: ${this.stats.deletedFiles}`);
    console.log(`  ✂️  Files truncated: ${this.stats.truncatedFiles}`);
    console.log(`  💾 Space saved: ${this.formatBytes(this.stats.totalSpaceSaved)}`);

    if (this.stats.errors.length > 0) {
      console.log(`  ⚠️  Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach((error) => console.log(`    - ${error}`));
    }

    console.log("\n✅ Cleanup completed successfully!");
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  const cleanup = new LogCleanup();
  cleanup.run().catch(console.error);
}

export { LogCleanup };
