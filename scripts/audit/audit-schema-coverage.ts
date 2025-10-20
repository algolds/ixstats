#!/usr/bin/env tsx
/**
 * Schema Coverage Audit Script for IxStats v1.1
 * 
 * Generates comprehensive coverage report showing:
 * - Which Prisma models have CRUD operations
 * - Missing CRUD operations for user-facing models
 * - Coverage percentage by model and router
 * - Recommendations for missing operations
 * 
 * Usage: npx tsx scripts/audit/audit-schema-coverage.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ModelCoverage {
  model: string;
  hasCreate: boolean;
  hasRead: boolean;
  hasUpdate: boolean;
  hasDelete: boolean;
  hasBulk: boolean;
  routers: string[];
  coverage: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  userFacing: boolean;
}

interface RouterCoverage {
  router: string;
  totalModels: number;
  coveredModels: number;
  coverage: number;
  operations: number;
}

interface CoverageReport {
  totalModels: number;
  userFacingModels: number;
  fullyCoveredModels: number;
  partiallyCoveredModels: number;
  uncoveredModels: number;
  overallCoverage: number;
  modelCoverage: ModelCoverage[];
  routerCoverage: RouterCoverage[];
  recommendations: string[];
}

const report: CoverageReport = {
  totalModels: 0,
  userFacingModels: 0,
  fullyCoveredModels: 0,
  partiallyCoveredModels: 0,
  uncoveredModels: 0,
  overallCoverage: 0,
  modelCoverage: [],
  routerCoverage: [],
  recommendations: []
};

// User-facing models that require full CRUD coverage
const USER_FACING_MODELS = [
  'Country', 'User', 'GovernmentStructure', 'GovernmentDepartment', 'GovernmentOfficial',
  'Policy', 'MilitaryBranch', 'MilitaryUnit', 'MilitaryAsset', 'ThinkpagesAccount',
  'ThinkpagesPost', 'ThinktankGroup', 'ThinktankMember', 'Embassy', 'DiplomaticMission',
  'EconomicComponent', 'TaxComponent', 'GovernmentComponent', 'ActivitySchedule',
  'QuickActionTemplate', 'IntelligenceItem', 'TrendingTopic', 'Archetype', 'Role'
];

// System models that may only need read operations
const SYSTEM_MODELS = [
  'DmInputs', 'EconomicModel', 'SectoralOutput', 'PolicyEffect', 'CrisisEvent',
  'ActivityFeed', 'TaxSystem', 'TaxCategory', 'TaxBracket', 'TaxExemption',
  'TaxDeduction', 'TaxPolicy', 'TaxCalculation', 'ComponentSynergy', 'BudgetScenario',
  'EconomicEffect', 'ThinkshareConversation', 'ThinkshareParticipant', 'ThinkshareMessage',
  'CollaborativeDoc', 'PostReaction', 'PostMention', 'PostHashtag', 'CountryMoodMetric',
  'ScheduledChange', 'Achievement', 'UserAchievement', 'WikiCache', 'WikiImportLog'
];

// Parse Prisma schema to get all models
function parsePrismaModels(): string[] {
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  
  const models: string[] = [];
  const modelRegex = /^model\s+(\w+)/gm;
  let match;
  
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    models.push(match[1]);
  }
  
  return models;
}

// Parse router files to find CRUD operations
function parseRouterOperations(): Map<string, { operations: string[]; models: string[] }> {
  const routerOps = new Map<string, { operations: string[]; models: string[] }>();
  const routersDir = join(process.cwd(), 'src', 'server', 'api', 'routers');
  
  try {
    const routerFiles = readdirSync(routersDir).filter(file => file.endsWith('.ts') && !file.startsWith('__'));
    
    for (const file of routerFiles) {
      const filePath = join(routersDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      const operations: string[] = [];
      const models: string[] = [];
      
      // Find tRPC procedures
      const procedureRegex = /(\w+):\s*(publicProcedure|protectedProcedure|adminProcedure)/g;
      let match;
      
      while ((match = procedureRegex.exec(content)) !== null) {
        operations.push(match[1]);
      }
      
      // Find database operations and infer models
      const dbOps = [
        { pattern: /\.create\(/g, models: ['create'] },
        { pattern: /\.findMany\(/g, models: ['read'] },
        { pattern: /\.findUnique\(/g, models: ['read'] },
        { pattern: /\.update\(/g, models: ['update'] },
        { pattern: /\.delete\(/g, models: ['delete'] },
        { pattern: /\.createMany\(/g, models: ['bulk'] },
        { pattern: /\.updateMany\(/g, models: ['bulk'] },
        { pattern: /\.deleteMany\(/g, models: ['bulk'] }
      ];
      
      for (const dbOp of dbOps) {
        const matches = content.match(dbOp.pattern);
        if (matches) {
          models.push(...dbOp.models);
        }
      }
      
      // Infer specific models from content
      const modelPatterns = [
        { pattern: /militaryBranch/g, model: 'MilitaryBranch' },
        { pattern: /governmentOfficial/g, model: 'GovernmentOfficial' },
        { pattern: /thinkpagesAccount/g, model: 'ThinkpagesAccount' },
        { pattern: /thinkpagesPost/g, model: 'ThinkpagesPost' },
        { pattern: /governmentDepartment/g, model: 'GovernmentDepartment' },
        { pattern: /policy/g, model: 'Policy' },
        { pattern: /embassy/g, model: 'Embassy' },
        { pattern: /diplomaticMission/g, model: 'DiplomaticMission' },
        { pattern: /economicComponent/g, model: 'EconomicComponent' },
        { pattern: /taxComponent/g, model: 'TaxComponent' },
        { pattern: /governmentComponent/g, model: 'GovernmentComponent' },
        { pattern: /intelligenceItem/g, model: 'IntelligenceItem' },
        { pattern: /trendingTopic/g, model: 'TrendingTopic' },
        { pattern: /thinktankGroup/g, model: 'ThinktankGroup' },
        { pattern: /activitySchedule/g, model: 'ActivitySchedule' },
        { pattern: /quickActionTemplate/g, model: 'QuickActionTemplate' }
      ];
      
      for (const modelPattern of modelPatterns) {
        if (content.match(modelPattern.pattern)) {
          models.push(modelPattern.model);
        }
      }
      
      routerOps.set(file, { operations, models: [...new Set(models)] });
    }
  } catch (error) {
    console.error('Error parsing router operations:', error);
  }
  
  return routerOps;
}

// Analyze coverage for each model
function analyzeModelCoverage(models: string[], routerOps: Map<string, { operations: string[]; models: string[] }>): void {
  for (const model of models) {
    const coverage: ModelCoverage = {
      model,
      hasCreate: false,
      hasRead: false,
      hasUpdate: false,
      hasDelete: false,
      hasBulk: false,
      routers: [],
      coverage: 0,
      priority: 'low',
      userFacing: USER_FACING_MODELS.includes(model)
    };
    
    // Check each router for this model
    for (const [router, data] of routerOps) {
      if (data.models.includes(model)) {
        coverage.routers.push(router);
        
        // Check for specific operations
        const operations = data.operations.join(' ').toLowerCase();
        if (operations.includes('create')) coverage.hasCreate = true;
        if (operations.includes('get') || operations.includes('list') || operations.includes('find')) coverage.hasRead = true;
        if (operations.includes('update')) coverage.hasUpdate = true;
        if (operations.includes('delete')) coverage.hasDelete = true;
        if (operations.includes('bulk')) coverage.hasBulk = true;
      }
    }
    
    // Calculate coverage percentage
    const operations = [coverage.hasCreate, coverage.hasRead, coverage.hasUpdate, coverage.hasDelete];
    coverage.coverage = (operations.filter(Boolean).length / operations.length) * 100;
    
    // Determine priority
    if (coverage.userFacing) {
      if (coverage.coverage < 50) coverage.priority = 'critical';
      else if (coverage.coverage < 75) coverage.priority = 'high';
      else if (coverage.coverage < 100) coverage.priority = 'medium';
      else coverage.priority = 'low';
    } else {
      coverage.priority = 'low';
    }
    
    report.modelCoverage.push(coverage);
  }
}

// Analyze router coverage
function analyzeRouterCoverage(routerOps: Map<string, { operations: string[]; models: string[] }>): void {
  for (const [router, data] of routerOps) {
    const routerCoverage: RouterCoverage = {
      router,
      totalModels: data.models.length,
      coveredModels: data.models.length,
      coverage: 100,
      operations: data.operations.length
    };
    
    report.routerCoverage.push(routerCoverage);
  }
}

// Generate recommendations
function generateRecommendations(): void {
  const criticalModels = report.modelCoverage.filter(m => m.priority === 'critical' && m.userFacing);
  const highPriorityModels = report.modelCoverage.filter(m => m.priority === 'high' && m.userFacing);
  
  if (criticalModels.length > 0) {
    report.recommendations.push('🚨 CRITICAL: Add missing CRUD operations for: ' + 
      criticalModels.map(m => m.model).join(', '));
  }
  
  if (highPriorityModels.length > 0) {
    report.recommendations.push('⚠️ HIGH PRIORITY: Improve coverage for: ' + 
      highPriorityModels.map(m => m.model).join(', '));
  }
  
  // Check for models with no coverage
  const uncoveredModels = report.modelCoverage.filter(m => m.coverage === 0 && m.userFacing);
  if (uncoveredModels.length > 0) {
    report.recommendations.push('📝 Consider adding basic CRUD operations for: ' + 
      uncoveredModels.map(m => m.model).join(', '));
  }
  
  // Check for missing bulk operations
  const modelsNeedingBulk = report.modelCoverage.filter(m => 
    m.userFacing && !m.hasBulk && (m.model.includes('Component') || m.model.includes('Official'))
  );
  if (modelsNeedingBulk.length > 0) {
    report.recommendations.push('🔄 Consider adding bulk operations for: ' + 
      modelsNeedingBulk.map(m => m.model).join(', '));
  }
}

// Calculate overall statistics
function calculateStatistics(): void {
  report.totalModels = report.modelCoverage.length;
  report.userFacingModels = report.modelCoverage.filter(m => m.userFacing).length;
  report.fullyCoveredModels = report.modelCoverage.filter(m => m.coverage === 100).length;
  report.partiallyCoveredModels = report.modelCoverage.filter(m => m.coverage > 0 && m.coverage < 100).length;
  report.uncoveredModels = report.modelCoverage.filter(m => m.coverage === 0).length;
  
  const totalCoverage = report.modelCoverage.reduce((sum, m) => sum + m.coverage, 0);
  report.overallCoverage = totalCoverage / report.modelCoverage.length;
}

// Print results
function printResults(): void {
  console.log('📊 Schema Coverage Audit Results\n');
  
  console.log('📈 Overall Statistics:');
  console.log(`  Total models: ${report.totalModels}`);
  console.log(`  User-facing models: ${report.userFacingModels}`);
  console.log(`  Fully covered: ${report.fullyCoveredModels}`);
  console.log(`  Partially covered: ${report.partiallyCoveredModels}`);
  console.log(`  Uncovered: ${report.uncoveredModels}`);
  console.log(`  Overall coverage: ${report.overallCoverage.toFixed(1)}%\n`);
  
  // Critical issues
  const critical = report.modelCoverage.filter(m => m.priority === 'critical');
  if (critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    critical.forEach(model => {
      console.log(`  ❌ ${model.model}: ${model.coverage.toFixed(1)}% coverage`);
      console.log(`     Missing: ${[
        !model.hasCreate && 'Create',
        !model.hasRead && 'Read', 
        !model.hasUpdate && 'Update',
        !model.hasDelete && 'Delete'
      ].filter(Boolean).join(', ')}`);
      console.log(`     Routers: ${model.routers.join(', ')}`);
    });
    console.log('');
  }
  
  // High priority issues
  const high = report.modelCoverage.filter(m => m.priority === 'high');
  if (high.length > 0) {
    console.log('⚠️  HIGH PRIORITY:');
    high.forEach(model => {
      console.log(`  ⚠️  ${model.model}: ${model.coverage.toFixed(1)}% coverage`);
    });
    console.log('');
  }
  
  // Router coverage
  console.log('📁 Router Coverage:');
  report.routerCoverage
    .sort((a, b) => b.operations - a.operations)
    .forEach(router => {
      console.log(`  📄 ${router.router}: ${router.operations} operations, ${router.coveredModels} models`);
    });
  console.log('');
  
  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  ${rec}`));
    console.log('');
  }
  
  // Success/failure
  if (critical.length > 0) {
    console.log('❌ Coverage audit FAILED - Critical models need CRUD operations');
    process.exit(1);
  } else if (high.length > 0) {
    console.log('⚠️  Coverage audit PASSED with warnings - High priority models need attention');
    process.exit(0);
  } else {
    console.log('✅ Coverage audit PASSED - All critical models have adequate coverage');
    process.exit(0);
  }
}

// Save detailed report to JSON
function saveDetailedReport(): void {
  const reportPath = join(process.cwd(), 'scripts', 'audit', 'reports', 'schema-coverage-report.json');
  
  try {
    // Ensure reports directory exists
    const reportsDir = join(process.cwd(), 'scripts', 'audit', 'reports');
    if (!require('fs').existsSync(reportsDir)) {
      require('fs').mkdirSync(reportsDir, { recursive: true });
    }
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error saving detailed report:', error);
  }
}

// Main execution
function main(): void {
  try {
    console.log('🔍 Analyzing schema coverage...\n');
    
    const models = parsePrismaModels();
    const routerOps = parseRouterOperations();
    
    analyzeModelCoverage(models, routerOps);
    analyzeRouterCoverage(routerOps);
    generateRecommendations();
    calculateStatistics();
    
    printResults();
    saveDetailedReport();
  } catch (error) {
    console.error('❌ Coverage audit failed with error:', error);
    process.exit(1);
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeModelCoverage, parsePrismaModels, parseRouterOperations };
