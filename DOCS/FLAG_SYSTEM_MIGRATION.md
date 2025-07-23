# Flag System Migration Guide

This document describes the migration from the previous flag caching system to the new improved flag system with local file storage.

## Overview of Changes

### Old System Issues
1. **No Local Storage**: Only cached URLs in memory, dependent on external MediaWiki availability
2. **Inconsistent Loading**: Multiple hooks and approaches (useFlag, useBulkFlagCache, useBatchFlags)
3. **Complex State Management**: Overlapping responsibilities across multiple services
4. **External Dependencies**: All flags relied on MediaWiki URLs being accessible

### New System Benefits
1. **Local File Storage**: Downloads and stores flag images in `/public/flags/` for fast, reliable access
2. **Unified API**: Single hook system (`useUnifiedFlags`) with legacy compatibility
3. **Improved Reliability**: Local files serve as primary source, external URLs as fallback
4. **Better Performance**: Instant loading for locally cached flags

## Migration Steps

### 1. Service Layer Migration

**Before:**
```typescript
import { flagService } from '~/lib/flag-service';
import { flagCacheManager } from '~/lib/flag-cache-manager';
```

**After:**
```typescript
import { improvedFlagService } from '~/lib/improved-flag-service';
import { enhancedFlagCacheManager } from '~/lib/enhanced-flag-cache-manager';
```

### 2. Hook Migration

**Before (Multiple Hooks):**
```typescript
// Old individual flag loading
import { useFlag } from '~/hooks/useFlag';
import { useBulkFlagCache } from '~/hooks/useBulkFlagCache';
import { useBatchFlags } from '~/hooks/useBatchFlags';

// Different approaches in different components
const { flagUrl, isLoading } = useFlag(countryName);
const { flagUrls } = useBulkFlagCache(countryNames);
const { flagUrls } = useBatchFlags(countryNames);
```

**After (Unified Hooks):**
```typescript
// New unified system with legacy compatibility
import { useFlag, useBulkFlags } from '~/hooks/useUnifiedFlags';

// Consistent API across all use cases
const { flagUrl, isLoading, isLocal } = useFlag(countryName);
const { flagUrls, localCount } = useBulkFlags(countryNames);

// Legacy aliases still work during transition
import { useBulkFlagCache } from '~/hooks/useUnifiedFlags'; // Alias to useBulkFlags
```

### 3. Component Migration

**Before:**
```typescript
import { CountryFlag } from '~/app/_components/CountryFlag';

<CountryFlag countryName={country} size="md" />
```

**After:**
```typescript
import { UnifiedCountryFlag } from '~/components/UnifiedCountryFlag';

<UnifiedCountryFlag 
  countryName={country} 
  size="md" 
  showTooltip={true}
  rounded={true}
/>
```

## New Features

### 1. Local File Storage
Flags are now downloaded and stored locally in `/public/flags/`:
- Instant loading for cached flags
- Reduced external dependency
- Better offline support

### 2. Enhanced Statistics
```typescript
import { useFlagServiceStats } from '~/hooks/useUnifiedFlags';

const { stats } = useFlagServiceStats();
// stats now includes:
// - localFiles: number of flags stored locally
// - isUpdating: real-time update status
// - updateProgress: download progress
```

### 3. Improved Component Props
```typescript
<UnifiedCountryFlag 
  countryName="United_States"
  size="md"              // xs | sm | md | lg | xl
  showTooltip={true}     // Show hover tooltips
  isLocal={true}         // Visual indicator for local files
  rounded={true}         // Rounded corners
  shadow={true}          // Drop shadow
  border={true}          // Border styling
/>
```

### 4. Batch Operations
```typescript
const { flagUrls, localCount, placeholderCount } = useBulkFlags(countryNames);
```

## File Structure Changes

### New Files Added
- `src/lib/enhanced-flag-cache-manager.ts` - Core cache manager with local storage
- `src/lib/improved-flag-service.ts` - Unified flag service 
- `src/hooks/useUnifiedFlags.ts` - Consolidated hooks
- `src/components/UnifiedCountryFlag.tsx` - Enhanced flag component

### Files to Migrate From (Keep During Transition)
- `src/lib/flag-service.ts` (legacy, replace imports)
- `src/lib/flag-cache-manager.ts` (legacy, replace imports)
- `src/hooks/useFlag.ts` (legacy, replace imports)
- `src/hooks/useBulkFlagCache.ts` (legacy, replace imports)
- `src/app/_components/CountryFlag.tsx` (legacy, replace imports)

### Directory Structure
```
public/
  flags/
    metadata.json          # Flag cache metadata
    United_States.png      # Downloaded flag files
    Germany.svg
    ...
```

## API Changes

### Enhanced Flag API Response
```typescript
// Old response
{
  flagUrl: string,
  cached: boolean
}

// New response
{
  flagUrl: string,
  cached: boolean,
  isLocal: boolean,      // Whether flag is stored locally
  isPlaceholder: boolean // Whether using placeholder
}
```

### Flag Cache API Updates
```typescript
// GET /api/flag-cache?action=stats
{
  totalCountries: number,
  cachedFlags: number,
  localFiles: number,        // New: count of local files
  updateProgress: {          // New: real-time progress
    current: number,
    total: number,
    percentage: number
  }
}
```

## Migration Timeline

### Phase 1: Dual System (Current)
- New system implemented alongside old system
- Components can use either system
- Legacy compatibility maintained

### Phase 2: Gradual Migration (Next)
- Update components one by one to use new system
- Test thoroughly in development
- Monitor performance improvements

### Phase 3: Full Migration (Future)
- Remove legacy files
- Update all components to new system
- Clean up unused imports

## Testing the Migration

### 1. Test Local File Storage
```bash
# Check if flags are being downloaded
ls -la public/flags/

# Should see metadata.json and flag image files
```

### 2. Test Component Integration
```typescript
// Test that new component works with your data
<UnifiedCountryFlag countryName="United_States" size="md" />
```

### 3. Test Bulk Loading
```typescript
const countryNames = ['United_States', 'Germany', 'Japan'];
const { flagUrls, isLoading, localCount } = useBulkFlags(countryNames);

// localCount should increase as flags are downloaded
```

### 4. Test API Endpoints
```bash
# Test enhanced API
curl "http://localhost:3000/api/flags/United_States"
curl "http://localhost:3000/api/flag-cache?action=stats"
```

## Troubleshooting

### Common Issues

1. **Flags Not Downloading Locally**
   - Check file permissions on `/public/flags/` directory
   - Verify enhanced flag cache manager is being used
   - Check server logs for download errors

2. **Components Not Loading Flags**
   - Ensure using correct import paths
   - Check that country names match expected format
   - Verify props are being passed correctly

3. **Performance Issues**
   - Monitor batch loading size (default: 5 concurrent)
   - Check if too many individual flag requests
   - Use bulk loading for multiple flags

### Debug Commands

```typescript
// Check flag service status
console.log(improvedFlagService.getStats());

// Check if flag is local
console.log(improvedFlagService.hasLocalFlag('United_States'));

// Force cache update
await improvedFlagService.updateAllFlags();
```

## Benefits After Migration

1. **Reliability**: Flags load instantly from local files
2. **Performance**: Reduced network requests and faster loading
3. **Consistency**: Unified API across all components
4. **Maintainability**: Single source of truth for flag loading
5. **Scalability**: Better handling of bulk flag operations

## Support

For migration issues:
1. Check console logs for detailed error messages
2. Verify file system permissions
3. Test with small batches first
4. Use the flag service stats to monitor progress