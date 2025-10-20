# XLSX Library Migration Guide

## Overview

IxStats currently uses the `xlsx` library (SheetJS) for Excel file import/export functionality. This guide documents the migration path to the more secure `exceljs` library to address potential security vulnerabilities.

## Current Vulnerability Details

### Risk Assessment
- **Severity**: MEDIUM
- **CVSS Score**: 5.3 (Medium)
- **Vulnerability Type**: Prototype pollution, arbitrary code execution potential
- **Affected Package**: `xlsx` (all versions prior to security patches)
- **Impact**: Potential for malicious Excel files to inject code or manipulate application state

### Current Usage Locations

1. **`/src/lib/excel-exporter.ts`**
   - Purpose: Exports country statistics to Excel format
   - Functions: `exportCountriesToExcel()`
   - XLSX Features Used:
     - `XLSX.utils.json_to_sheet()` - Convert JSON to worksheet
     - `XLSX.utils.book_new()` - Create new workbook
     - `XLSX.utils.book_append_sheet()` - Add sheets to workbook
     - `XLSX.write()` - Generate Excel file buffer
   - Complexity: MEDIUM (3 sheets with metadata)

2. **`/src/lib/excel-handler.ts`**
   - Purpose: Parses imported Excel files for country data
   - Functions: `parseFile()`, `parseExcelBuffer()`
   - XLSX Features Used:
     - `XLSX.read()` - Parse Excel buffer
     - `XLSX.utils.sheet_to_json()` - Convert worksheet to JSON
   - Complexity: HIGH (complex field mapping, validation)

3. **`/src/lib/data-parser.ts`**
   - Purpose: Generic data parsing utilities
   - Functions: Helper functions for number/percentage parsing
   - XLSX Features Used: Minimal (uses helper functions)
   - Complexity: LOW

4. **`/src/app/builder/lib/economy-data-service.ts`**
   - Purpose: Economy builder data import
   - Functions: Data transformation and validation
   - XLSX Features Used: Import only
   - Complexity: MEDIUM

## Migration Path to ExcelJS

### Why ExcelJS?

1. **Active Maintenance**: Regular security updates and community support
2. **No Prototype Pollution**: Type-safe implementation without known vulnerabilities
3. **Better Type Safety**: Full TypeScript support out of the box
4. **Feature Parity**: Supports all features currently used in IxStats
5. **Performance**: Similar or better performance for our use cases
6. **Modern API**: Promise-based, async/await friendly

### Installation

```bash
npm install exceljs
npm install --save-dev @types/exceljs
npm uninstall xlsx
```

### Migration Mapping

#### Reading Excel Files

**Current (xlsx):**
```typescript
import * as XLSX from 'xlsx';

const workbook = XLSX.read(buffer, {
  type: 'buffer',
  cellDates: true,
  cellNF: false,
  cellText: false
});

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
```

**Migrated (exceljs):**
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);

const worksheet = workbook.worksheets[0];
const data: any[][] = [];

worksheet.eachRow((row, rowNumber) => {
  const rowValues: any[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rowValues.push(cell.value);
  });
  data.push(rowValues);
});
```

#### Writing Excel Files

**Current (xlsx):**
```typescript
import * as XLSX from 'xlsx';

const exportData = countries.map(country => ({
  'Country': country.country,
  'Population': country.currentPopulation,
  // ... more fields
}));

const worksheet = XLSX.utils.json_to_sheet(exportData);
worksheet['!cols'] = colWidths;

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Sheet');

return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
```

**Migrated (exceljs):**
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Data Sheet');

// Add headers
worksheet.columns = [
  { header: 'Country', key: 'country', width: 20 },
  { header: 'Population', key: 'population', width: 15 },
  // ... more columns
];

// Add rows
countries.forEach(country => {
  worksheet.addRow({
    country: country.country,
    population: country.currentPopulation,
    // ... more fields
  });
});

// Generate buffer
const buffer = await workbook.xlsx.writeBuffer();
return buffer;
```

## Step-by-Step Migration Plan

### Phase 1: Preparation (1-2 hours)

1. **Audit Current Usage**
   - [x] Identify all files using xlsx
   - [x] Document current functionality
   - [x] Create test cases for existing behavior

2. **Install ExcelJS**
   ```bash
   npm install exceljs @types/exceljs
   ```

3. **Create Compatibility Layer** (optional)
   - Create wrapper functions that use ExcelJS internally
   - Maintain existing API surface for gradual migration

### Phase 2: Migrate Export Functionality (2-3 hours)

1. **Update `excel-exporter.ts`**
   ```typescript
   // Before: Line 4
   import * as XLSX from 'xlsx';

   // After:
   import ExcelJS from 'exceljs';
   ```

2. **Refactor `exportCountriesToExcel()` function**
   - Replace `XLSX.utils.json_to_sheet()` with ExcelJS worksheet creation
   - Replace `XLSX.utils.book_new()` with `new ExcelJS.Workbook()`
   - Replace `XLSX.write()` with `workbook.xlsx.writeBuffer()`

3. **Migrate Column Width Settings**
   - ExcelJS uses `worksheet.columns` with width property
   - More intuitive than xlsx's `worksheet['!cols']` approach

4. **Test Export Functionality**
   - Verify Excel file structure
   - Confirm all 3 sheets (Data, Metadata, Field Reference) are present
   - Validate column widths and formatting

### Phase 3: Migrate Import Functionality (3-4 hours)

1. **Update `excel-handler.ts`**
   - Refactor `parseExcelBuffer()` method
   - Replace `XLSX.read()` with ExcelJS workbook loading
   - Replace `XLSX.utils.sheet_to_json()` with row iteration

2. **Handle Async/Await**
   - ExcelJS operations are async
   - Update `parseFile()` to properly handle async workbook loading
   - Add error handling for async operations

3. **Preserve Field Mapping Logic**
   - Keep existing `FIELD_MAPPINGS` array
   - Maintain header detection and alias matching
   - Preserve validation logic

4. **Test Import Functionality**
   - Test with various Excel formats (.xlsx, .xls)
   - Verify field mapping accuracy
   - Confirm error handling works correctly

### Phase 4: Update Dependencies (1 hour)

1. **Update `data-parser.ts`**
   - Refactor if needed for ExcelJS compatibility
   - Update type definitions

2. **Update `economy-data-service.ts`**
   - Ensure compatibility with new Excel handler
   - Test economy data imports

3. **Update Package.json**
   ```bash
   npm uninstall xlsx
   ```

### Phase 5: Testing & Validation (2-3 hours)

1. **Unit Tests**
   ```typescript
   // Create test cases for:
   describe('ExcelJS Migration', () => {
     it('exports countries to Excel with correct format', async () => {
       // Test export functionality
     });

     it('imports countries from Excel correctly', async () => {
       // Test import functionality
     });

     it('handles malformed Excel files gracefully', async () => {
       // Test error handling
     });
   });
   ```

2. **Integration Tests**
   - Test full export/import cycle
   - Verify data integrity
   - Test with production-like data volumes

3. **Security Validation**
   - Test with potentially malicious Excel files
   - Verify no prototype pollution
   - Confirm no code execution vulnerabilities

## Code Examples

### Example 1: Complete Export Migration

```typescript
// src/lib/excel-exporter.ts (migrated)
import ExcelJS from 'exceljs';
import { IxTime } from './ixtime';
import type { CountryStats } from '../types/ixstats';

export async function exportCountriesToExcel(countries: CountryStats[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('IxStats Export');

  // Define columns with headers and widths
  worksheet.columns = [
    { header: 'Country', key: 'country', width: 20 },
    { header: 'Continent', key: 'continent', width: 12 },
    { header: 'Region', key: 'region', width: 15 },
    { header: 'Government Type', key: 'governmentType', width: 25 },
    { header: 'Religion', key: 'religion', width: 20 },
    { header: 'Leader', key: 'leader', width: 25 },
    { header: 'Population', key: 'population', width: 15 },
    { header: 'GDP PC', key: 'gdpPerCapita', width: 12 },
    // ... more columns
  ];

  // Add data rows
  countries.forEach(country => {
    worksheet.addRow({
      country: country.country,
      continent: country.continent || '',
      region: country.region || '',
      governmentType: country.governmentType || '',
      religion: country.religion || '',
      leader: country.leader || '',
      population: Math.round(country.currentPopulation),
      gdpPerCapita: parseFloat(country.currentGdpPerCapita.toFixed(2)),
      // ... more fields
    });
  });

  // Add metadata sheet
  const metadataSheet = workbook.addWorksheet('Export Metadata');
  metadataSheet.columns = [
    { header: 'Property', key: 'property', width: 30 },
    { header: 'Value', key: 'value', width: 50 }
  ];

  metadataSheet.addRows([
    { property: 'Export Date', value: new Date().toISOString() },
    { property: 'Export Type', value: 'Excel-only (13 core fields)' },
    { property: 'Countries Exported', value: countries.length.toString() },
    // ... more metadata
  ]);

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
```

### Example 2: Complete Import Migration

```typescript
// src/lib/excel-handler.ts (migrated)
import ExcelJS from 'exceljs';
import type { BaseCountryData } from '../types/ixstats';

export class IxStatsExcelHandler {
  async parseFile(fileBuffer: ArrayBuffer, fileName?: string): Promise<ExcelParseResult> {
    const result: ExcelParseResult = {
      success: false,
      data: [],
      errors: [],
      warnings: [],
      metadata: { totalRows: 0, validRows: 0, skippedRows: 0, fileName }
    };

    try {
      if (fileName && !this.isExcelFile(fileName)) {
        result.errors.push('Only Excel files (.xlsx, .xls) are supported.');
        return result;
      }

      const rawData = await this.parseExcelBuffer(fileBuffer);

      if (!rawData || rawData.length < 2) {
        result.errors.push('Excel file must contain at least a header row and one data row');
        return result;
      }

      result.metadata.totalRows = rawData.length - 1;

      // Parse headers and process data
      const headers = rawData[0]?.map(h => String(h || '').trim()) || [];
      const fieldIndexMap = this.createFieldIndexMap(headers);

      // ... rest of parsing logic (unchanged)

      result.success = true;
      return result;

    } catch (error) {
      result.errors.push(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private async parseExcelBuffer(buffer: ArrayBuffer): Promise<any[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheets found in Excel file');
    }

    const data: any[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const rowValues: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowValues.push(cell.value);
      });
      data.push(rowValues);
    });

    return data;
  }
}
```

## Testing Requirements

### Pre-Migration Tests

Create comprehensive tests BEFORE migration to ensure no regression:

```typescript
// src/tests/excel-migration.test.ts
describe('Excel Functionality (Pre-Migration)', () => {
  describe('Export', () => {
    it('exports country data with correct format', () => {
      const countries = getMockCountries();
      const buffer = exportCountriesToExcel(countries);

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      // Verify structure using xlsx library
      const workbook = XLSX.read(buffer);
      expect(workbook.SheetNames).toContain('IxStats Export');
      expect(workbook.SheetNames).toContain('Export Metadata');
    });
  });

  describe('Import', () => {
    it('imports valid Excel file correctly', async () => {
      const testFile = readTestFile('valid-countries.xlsx');
      const result = await excelHandler.parseFile(testFile);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles malformed Excel files gracefully', async () => {
      const testFile = readTestFile('malformed.xlsx');
      const result = await excelHandler.parseFile(testFile);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

### Post-Migration Tests

Run the same tests with ExcelJS to verify feature parity:

```typescript
describe('Excel Functionality (Post-Migration - ExcelJS)', () => {
  // Exact same tests as above
  // All tests should pass with identical behavior
});
```

## Risk Mitigation

### Rollback Plan

1. **Keep xlsx as dev dependency temporarily**
   ```json
   {
     "devDependencies": {
       "xlsx": "^0.18.5"
     }
   }
   ```

2. **Feature flag for gradual rollout**
   ```typescript
   const USE_EXCELJS = process.env.EXCEL_LIBRARY === 'exceljs';

   export function exportCountriesToExcel(countries: CountryStats[]) {
     if (USE_EXCELJS) {
       return exportWithExcelJS(countries);
     } else {
       return exportWithXLSX(countries);
     }
   }
   ```

3. **A/B testing in production**
   - Deploy both versions
   - Monitor error rates
   - Roll back if issues detected

### Known Gotchas

1. **Async/Await Required**
   - ExcelJS operations are async
   - Update all calling code to use `await`
   - Add proper error handling

2. **Cell Value Types**
   - ExcelJS returns rich cell objects
   - Need to extract `.value` property
   - Handle dates, formulas differently

3. **Performance Considerations**
   - ExcelJS may be slightly slower for large files
   - Consider streaming API for files >10MB
   - Monitor memory usage

4. **Browser Compatibility**
   - ExcelJS works in both Node.js and browsers
   - May need polyfills for older browsers
   - Test in all target environments

## Timeline & Effort Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| 1 | Preparation & Planning | 1-2 hours |
| 2 | Migrate Export | 2-3 hours |
| 3 | Migrate Import | 3-4 hours |
| 4 | Update Dependencies | 1 hour |
| 5 | Testing & Validation | 2-3 hours |
| **Total** | | **9-13 hours** |

## Success Criteria

- [ ] All export functionality works identically
- [ ] All import functionality works identically
- [ ] No security vulnerabilities in dependency scan
- [ ] All tests pass
- [ ] Performance is comparable or better
- [ ] No user-facing changes (transparent migration)
- [ ] Documentation updated
- [ ] xlsx package removed from dependencies

## Security Benefits

After migration to ExcelJS:

1. **No Prototype Pollution**: ExcelJS doesn't modify Object.prototype
2. **Type Safety**: Full TypeScript support prevents type-related vulnerabilities
3. **Active Maintenance**: Regular security patches and updates
4. **No Arbitrary Code Execution**: Safe parsing without eval() or similar
5. **Input Validation**: Better handling of malformed files

## Conclusion

The migration from xlsx to ExcelJS is a **medium-priority security enhancement** that will:

- Eliminate known vulnerabilities in the xlsx library
- Improve type safety and code quality
- Provide better long-term maintainability
- Require approximately 9-13 hours of development effort
- Have minimal risk with proper testing and rollback planning

**Recommendation**: Schedule this migration for the next sprint after completing critical security fixes. The current xlsx usage is controlled (server-side only, no user-uploaded files processed without validation), so the immediate risk is LOW, but should be addressed proactively.
