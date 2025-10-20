#!/usr/bin/env tsx
/**
 * Migration Safety Validation Script for IxStats v1.1
 * 
 * Validates migration safety and schema drift:
 * - Check for pending migrations
 * - Validate all Prisma models have corresponding tables
 * - Detect schema drift between environments
 * - Verify migration order and dependencies
 * 
 * Usage: npx tsx scripts/audit/validate-migration-safety.ts
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface MigrationIssue {
  type: 'pending_migration' | 'schema_drift' | 'missing_table' | 'migration_order' | 'breaking_change';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  migration?: string;
}

interface MigrationValidationResult {
  totalMigrations: number;
  pendingMigrations: number;
  issues: MigrationIssue[];
  criticalIssues: number;
  warnings: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
}

const result: MigrationValidationResult = {
  totalMigrations: 0,
  pendingMigrations: 0,
  issues: [],
  criticalIssues: 0,
  warnings: 0,
  status: 'PASS'
};

// Check for pending migrations
function checkPendingMigrations(): void {
  try {
    const output = execSync('npx prisma migrate status', { encoding: 'utf-8' });
    
    if (output.includes('Database schema is up to date!')) {
      console.log('✅ Database schema is up to date');
    } else if (output.includes('Following migration(s) have not yet been applied')) {
      const pendingMatch = output.match(/Following migration\(s\) have not yet been applied:\s*\n((?:.*\n)*)/);
      if (pendingMatch) {
        const pendingMigrations = pendingMatch[1].trim().split('\n').filter(line => line.trim());
        result.pendingMigrations = pendingMigrations.length;
        
        pendingMigrations.forEach(migration => {
          result.issues.push({
            type: 'pending_migration',
            severity: 'critical',
            message: `Pending migration: ${migration}`,
            migration: migration.trim()
          });
          result.criticalIssues++;
        });
      }
    }
  } catch (error) {
    result.issues.push({
      type: 'pending_migration',
      severity: 'critical',
      message: `Error checking migration status: ${error instanceof Error ? error.message : String(error)}`,
    });
    result.criticalIssues++;
  }
}

// Validate all Prisma models have corresponding tables
async function validateModelTables(): Promise<void> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get all model names from schema
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    
    const modelRegex = /^model\s+(\w+)/gm;
    const models: string[] = [];
    let match;
    
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      models.push(match[1]);
    }
    
    result.totalMigrations = models.length;
    
    // Test each model with a simple query
    for (const model of models) {
      try {
        const tableName = model.charAt(0).toLowerCase() + model.slice(1);
        
        // Try to query the table (this will fail if table doesn't exist)
        await (prisma as any)[tableName].findFirst();
        
        console.log(`✅ Table exists for model: ${model}`);
      } catch (error) {
        result.issues.push({
          type: 'missing_table',
          severity: 'critical',
          message: `Table missing for model: ${model}`,
          details: error instanceof Error ? error.message : String(error)
        });
        result.criticalIssues++;
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    result.issues.push({
      type: 'missing_table',
      severity: 'critical',
      message: `Error validating model tables: ${error instanceof Error ? error.message : String(error)}`,
    });
    result.criticalIssues++;
  }
}

// Check migration files for potential issues
function checkMigrationFiles(): void {
  try {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    
    if (!existsSync(migrationsDir)) {
      result.issues.push({
        type: 'migration_order',
        severity: 'warning',
        message: 'No migrations directory found - database may not be initialized',
      });
      result.warnings++;
      return;
    }
    
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    // Check for migration naming consistency
    const invalidNaming = migrationFiles.filter(file => 
      !/^\d{14}_\w+\.sql$/.test(file)
    );
    
    if (invalidNaming.length > 0) {
      result.issues.push({
        type: 'migration_order',
        severity: 'warning',
        message: `Invalid migration file naming: ${invalidNaming.join(', ')}`,
        details: 'Migration files should follow format: YYYYMMDDHHMMSS_description.sql'
      });
      result.warnings++;
    }
    
    // Check for potential breaking changes in recent migrations
    const recentMigrations = migrationFiles.slice(-5); // Last 5 migrations
    
    for (const migration of recentMigrations) {
      const migrationPath = join(migrationsDir, migration);
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      
      // Check for DROP statements (potentially breaking)
      if (migrationContent.includes('DROP TABLE') || migrationContent.includes('DROP COLUMN')) {
        result.issues.push({
          type: 'breaking_change',
          severity: 'warning',
          message: `Potential breaking change in migration: ${migration}`,
          migration,
          details: 'Migration contains DROP statements that may cause data loss'
        });
        result.warnings++;
      }
      
      // Check for ALTER TABLE statements that might be unsafe
      if (migrationContent.includes('ALTER TABLE') && 
          (migrationContent.includes('DROP') || migrationContent.includes('MODIFY'))) {
        result.issues.push({
          type: 'breaking_change',
          severity: 'info',
          message: `Schema modification in migration: ${migration}`,
          migration,
          details: 'Migration contains ALTER TABLE statements - verify data compatibility'
        });
      }
    }
    
  } catch (error) {
    result.issues.push({
      type: 'migration_order',
      severity: 'critical',
      message: `Error checking migration files: ${error instanceof Error ? error.message : String(error)}`,
    });
    result.criticalIssues++;
  }
}

// Check for schema drift indicators
function checkSchemaDrift(): void {
  try {
    // Check if database is in sync with schema
    const output = execSync('npx prisma db push --accept-data-loss --skip-generate --dry-run', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    if (output.includes('Database is already in sync')) {
      console.log('✅ Database schema is in sync with Prisma schema');
    } else if (output.includes('Your database is now in sync')) {
      result.issues.push({
        type: 'schema_drift',
        severity: 'warning',
        message: 'Database schema is not in sync with Prisma schema',
        details: 'Run `npx prisma db push` to sync schema changes'
      });
      result.warnings++;
    }
  } catch (error) {
    // This is expected if there are schema differences
    result.issues.push({
      type: 'schema_drift',
      severity: 'info',
      message: 'Schema drift detected - database may need synchronization',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// Print validation results
function printResults(): void {
  console.log('\n📊 Migration Safety Validation Results\n');
  
  console.log(`Total migrations: ${result.totalMigrations}`);
  console.log(`Pending migrations: ${result.pendingMigrations}`);
  console.log(`Issues found: ${result.issues.length}`);
  console.log(`Critical issues: ${result.criticalIssues}`);
  console.log(`Warnings: ${result.warnings}\n`);
  
  if (result.issues.length === 0) {
    console.log('✅ All migration checks passed!');
    result.status = 'PASS';
    return;
  }
  
  // Group issues by type
  const critical = result.issues.filter(i => i.severity === 'critical');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const info = result.issues.filter(i => i.severity === 'info');
  
  if (critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    critical.forEach(issue => {
      console.log(`  ❌ ${issue.message}`);
      if (issue.details) console.log(`     ${issue.details}`);
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(issue => {
      console.log(`  ⚠️  ${issue.message}`);
      if (issue.details) console.log(`     ${issue.details}`);
    });
    console.log('');
  }
  
  if (info.length > 0) {
    console.log('ℹ️  INFO:');
    info.forEach(issue => {
      console.log(`  ℹ️  ${issue.message}`);
      if (issue.details) console.log(`     ${issue.details}`);
    });
    console.log('');
  }
  
  // Determine final status
  if (result.criticalIssues > 0) {
    result.status = 'FAIL';
    console.log('❌ Migration validation FAILED - Critical issues must be resolved');
  } else if (result.warnings > 0) {
    result.status = 'WARNING';
    console.log('⚠️  Migration validation PASSED with warnings - Review recommended');
  } else {
    result.status = 'PASS';
    console.log('✅ Migration validation PASSED - All checks successful');
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    console.log('🔍 Validating migration safety...\n');
    
    checkPendingMigrations();
    await validateModelTables();
    checkMigrationFiles();
    checkSchemaDrift();
      
    printResults();
    
    // Exit with appropriate code
    if (result.status === 'FAIL') {
      process.exit(1);
    } else if (result.status === 'WARNING') {
      process.exit(0);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration validation failed with error:', error);
    process.exit(1);
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkPendingMigrations, validateModelTables, checkMigrationFiles };
