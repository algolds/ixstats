#!/usr/bin/env tsx
/**
 * Schema Alignment Validation Script for IxStats v1.1
 * 
 * Compares Prisma model fields against Zod input schemas to detect:
 * - Missing fields in Zod schemas
 * - Type mismatches between Prisma and Zod
 * - Default value discrepancies
 * - Operations using spread operator without explicit validation
 * 
 * Usage: npx tsx scripts/audit/validate-schema-alignment.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

interface SchemaMismatch {
  router: string;
  schema: string;
  model: string;
  field: string;
  issue: 'missing_field' | 'type_mismatch' | 'default_mismatch' | 'spread_operator';
  prismaType?: string;
  zodType?: string;
  prismaDefault?: string;
  zodDefault?: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface ValidationResult {
  totalSchemas: number;
  totalMismatches: number;
  criticalIssues: number;
  warnings: number;
  mismatches: SchemaMismatch[];
}

const results: ValidationResult = {
  totalSchemas: 0,
  totalMismatches: 0,
  criticalIssues: 0,
  warnings: 0,
  mismatches: []
};

// Models with isActive fields that should be validated
const MODELS_WITH_ISACTIVE = [
  'User', 'IntelligenceItem', 'ThinkpagesAccount', 'TrendingTopic', 'ThinktankGroup',
  'QuickActionTemplate', 'ActivitySchedule', 'GovernmentOfficial', 'GovernmentDepartment',
  'Policy', 'EconomicComponent', 'TaxComponent', 'GovernmentComponent', 'MilitaryBranch',
  'MilitaryUnit', 'MilitaryAsset', 'TaxCategory', 'TaxBracket', 'TaxExemption',
  'TaxDeduction', 'TaxPolicy', 'TaxCalculation', 'ComponentSynergy', 'BudgetScenario',
  'PolicyEffect', 'EconomicEffect', 'ThinktankMember', 'ThinkshareConversation',
  'ThinkshareParticipant', 'Archetype', 'Role', 'DmInputs'
];

// Parse Prisma schema to extract model fields
function parsePrismaSchema(): Map<string, Map<string, { type: string; default?: string; optional: boolean }>> {
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  
  const models = new Map<string, Map<string, { type: string; default?: string; optional: boolean }>>();
  
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const modelContent = match[2];
    const fields = new Map<string, { type: string; default?: string; optional: boolean }>();
    
    // Parse fields within the model
    const fieldRegex = /^\s*(\w+)\s+([^@\s]+)(\s+@\w+[^@\n]*)?/gm;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(modelContent)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].trim();
      const attributes = fieldMatch[3] || '';
      
      // Skip special fields
      if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
        continue;
      }
      
      const isOptional = fieldType.includes('?');
      const cleanType = fieldType.replace('?', '').trim();
      
      // Extract default value
      const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
      const defaultValue = defaultMatch ? defaultMatch[1] : undefined;
      
      fields.set(fieldName, {
        type: cleanType,
        default: defaultValue,
        optional: isOptional
      });
    }
    
    models.set(modelName, fields);
  }
  
  return models;
}

// Parse Zod schemas from router files
function parseZodSchemas(): Map<string, Map<string, { type: string; default?: string; optional: boolean }>> {
  const schemas = new Map<string, Map<string, { type: string; default?: string; optional: boolean }>>();
  const routersDir = join(process.cwd(), 'src', 'server', 'api', 'routers');
  
  try {
    const routerFiles = readdirSync(routersDir).filter(file => file.endsWith('.ts') && !file.startsWith('__'));
    
    for (const file of routerFiles) {
      const filePath = join(routersDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Find Zod schema definitions
      const schemaRegex = /const\s+(\w+Schema)\s*=\s*z\.object\(\{([^}]+)\}\)/g;
      let match;
      
      while ((match = schemaRegex.exec(content)) !== null) {
        const schemaName = match[1];
        const schemaContent = match[2];
        const fields = new Map<string, { type: string; default?: string; optional: boolean }>();
        
        // Parse Zod field definitions
        const fieldRegex = /(\w+):\s*z\.(\w+)\([^)]*\)(?:\.optional\(\))?(?:\.default\(([^)]+)\))?/g;
        let fieldMatch;
        
        while ((fieldMatch = fieldRegex.exec(schemaContent)) !== null) {
          const fieldName = fieldMatch[1];
          const zodType = fieldMatch[2];
          const isOptional = schemaContent.includes(`${fieldName}:`) && schemaContent.includes('.optional()');
          const defaultValue = fieldMatch[3];
          
          fields.set(fieldName, {
            type: zodType,
            default: defaultValue,
            optional: isOptional
          });
        }
        
        schemas.set(`${file}:${schemaName}`, fields);
      }
    }
  } catch (error) {
    console.error('Error parsing Zod schemas:', error);
  }
  
  return schemas;
}

// Check for spread operator usage without explicit validation
function checkSpreadOperatorUsage(): SchemaMismatch[] {
  const mismatches: SchemaMismatch[] = [];
  const routersDir = join(process.cwd(), 'src', 'server', 'api', 'routers');
  
  try {
    const routerFiles = readdirSync(routersDir).filter(file => file.endsWith('.ts'));
    
    for (const file of routerFiles) {
      const filePath = join(routersDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Look for spread operator usage in database operations
      const spreadRegex = /\.(create|update)\(\s*\{\s*data:\s*\{\s*[^}]*\.\.\.\s*(\w+)/g;
      let match;
      
      while ((match = spreadRegex.exec(content)) !== null) {
        const operation = match[1];
        const spreadVariable = match[2];
        
        // Check if the spread variable is properly validated
        const validationRegex = new RegExp(`const\\s+${spreadVariable}\\s*=\\s*z\\.object`, 'g');
        if (!validationRegex.test(content)) {
          mismatches.push({
            router: file,
            schema: 'unknown',
            model: 'unknown',
            field: spreadVariable,
            issue: 'spread_operator',
            severity: 'warning',
            message: `Spread operator used for ${operation} without explicit validation: ${spreadVariable}`
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking spread operator usage:', error);
  }
  
  return mismatches;
}

// Type mapping between Prisma and Zod
const TYPE_MAPPINGS: Record<string, string[]> = {
  'String': ['string', 'enum'],
  'Int': ['number', 'int'],
  'Float': ['number'],
  'Boolean': ['boolean'],
  'DateTime': ['date'],
  'Json': ['record', 'array', 'object']
};

function validateSchemaAlignment(): void {
  console.log('🔍 Validating schema alignment between Prisma and Zod...\n');
  
  const prismaModels = parsePrismaSchema();
  const zodSchemas = parseZodSchemas();
  
  results.totalSchemas = zodSchemas.size;
  
  // Check each Zod schema against corresponding Prisma model
  for (const [schemaKey, zodFields] of zodSchemas) {
    const [routerFile, schemaName] = schemaKey.split(':');
    
    // Try to infer model name from schema name
    let modelName = '';
    if (schemaName.includes('MilitaryBranch')) modelName = 'MilitaryBranch';
    else if (schemaName.includes('GovernmentOfficial')) modelName = 'GovernmentOfficial';
    else if (schemaName.includes('Policy')) modelName = 'Policy';
    else if (schemaName.includes('ThinkpagesAccount')) modelName = 'ThinkpagesAccount';
    else if (schemaName.includes('Department')) modelName = 'GovernmentDepartment';
    else if (schemaName.includes('User')) modelName = 'User';
    else if (schemaName.includes('Intelligence')) modelName = 'IntelligenceItem';
    else if (schemaName.includes('Trending')) modelName = 'TrendingTopic';
    else if (schemaName.includes('Thinktank')) modelName = 'ThinktankGroup';
    else if (schemaName.includes('Economic')) modelName = 'EconomicComponent';
    else if (schemaName.includes('Tax')) modelName = 'TaxComponent';
    else if (schemaName.includes('Government')) modelName = 'GovernmentComponent';
    
    if (!modelName || !prismaModels.has(modelName)) {
      continue;
    }
    
    const prismaFields = prismaModels.get(modelName)!;
    
    // Check for missing fields
    for (const [fieldName, prismaField] of prismaFields) {
      if (!zodFields.has(fieldName)) {
        // Only flag critical fields as missing
        if (fieldName === 'isActive' || fieldName === 'countryId' || fieldName === 'userId') {
          results.mismatches.push({
            router: routerFile,
            schema: schemaName,
            model: modelName,
            field: fieldName,
            issue: 'missing_field',
            prismaType: prismaField.type,
            severity: 'critical',
            message: `Missing critical field '${fieldName}' in ${schemaName}`
          });
          results.criticalIssues++;
        }
      } else {
        // Check type alignment
        const zodField = zodFields.get(fieldName)!;
        const expectedZodTypes = TYPE_MAPPINGS[prismaField.type] || [prismaField.type.toLowerCase()];
        
        if (!expectedZodTypes.includes(zodField.type)) {
          results.mismatches.push({
            router: routerFile,
            schema: schemaName,
            model: modelName,
            field: fieldName,
            issue: 'type_mismatch',
            prismaType: prismaField.type,
            zodType: zodField.type,
            severity: 'warning',
            message: `Type mismatch for '${fieldName}': Prisma ${prismaField.type} vs Zod ${zodField.type}`
          });
          results.warnings++;
        }
        
        // Check default value alignment
        if (prismaField.default && zodField.default && prismaField.default !== zodField.default) {
          results.mismatches.push({
            router: routerFile,
            schema: schemaName,
            model: modelName,
            field: fieldName,
            issue: 'default_mismatch',
            prismaDefault: prismaField.default,
            zodDefault: zodField.default,
            severity: 'info',
            message: `Default value mismatch for '${fieldName}': Prisma ${prismaField.default} vs Zod ${zodField.default}`
          });
        }
      }
    }
  }
  
  // Check for spread operator usage
  const spreadMismatches = checkSpreadOperatorUsage();
  results.mismatches.push(...spreadMismatches);
  results.warnings += spreadMismatches.length;
  
  results.totalMismatches = results.mismatches.length;
}

function printResults(): void {
  console.log('📊 Schema Alignment Validation Results\n');
  console.log(`Total schemas analyzed: ${results.totalSchemas}`);
  console.log(`Total mismatches found: ${results.totalMismatches}`);
  console.log(`Critical issues: ${results.criticalIssues}`);
  console.log(`Warnings: ${results.warnings}\n`);
  
  if (results.mismatches.length === 0) {
    console.log('✅ All schemas are properly aligned!');
    return;
  }
  
  // Group by severity
  const critical = results.mismatches.filter(m => m.severity === 'critical');
  const warnings = results.mismatches.filter(m => m.severity === 'warning');
  const info = results.mismatches.filter(m => m.severity === 'info');
  
  if (critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    critical.forEach(mismatch => {
      console.log(`  ❌ ${mismatch.router}:${mismatch.schema} - ${mismatch.message}`);
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(mismatch => {
      console.log(`  ⚠️  ${mismatch.router}:${mismatch.schema} - ${mismatch.message}`);
    });
    console.log('');
  }
  
  if (info.length > 0) {
    console.log('ℹ️  INFO:');
    info.forEach(mismatch => {
      console.log(`  ℹ️  ${mismatch.router}:${mismatch.schema} - ${mismatch.message}`);
    });
    console.log('');
  }
  
  // Summary
  if (results.criticalIssues > 0) {
    console.log('❌ Schema validation FAILED - Critical issues must be resolved');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('⚠️  Schema validation PASSED with warnings - Review recommended');
    process.exit(0);
  } else {
    console.log('✅ Schema validation PASSED - All schemas properly aligned');
    process.exit(0);
  }
}

// Main execution
function main(): void {
  try {
    validateSchemaAlignment();
    printResults();
  } catch (error) {
    console.error('❌ Schema validation failed with error:', error);
    process.exit(1);
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateSchemaAlignment, parsePrismaSchema, parseZodSchemas };
