# Builder System Documentation

## Overview

The IxStats Builder System is a comprehensive country creation and editing platform that supports both creation and editing workflows with advanced autosave capabilities.

## Architecture

### Core Components

1. **BuilderStateProvider** - Main context provider for builder state
2. **NationalIdentitySection** - National identity configuration interface
3. **useBuilderState** - Main state management hook with autosave
4. **useNationalIdentityAutoSync** - Dedicated autosave for national identity
5. **NationalIdentityRouter** - Backend API for national identity CRUD operations

### Autosave System

The builder implements a dual-layer autosave system:

#### Layer 1: LocalStorage Draft Persistence
- **Frequency**: 500ms debounced
- **Scope**: All builder state (economic inputs, government structure, tax system)
- **Recovery**: Automatic fallback to sessionStorage if localStorage fails
- **Protection**: Page unload handlers prevent data loss

#### Layer 2: Database Auto-Sync
- **Frequency**: 15 seconds debounced
- **Scope**: Individual sections (National Identity, Government, Tax, Economy)
- **Conflict Detection**: Built-in conflict resolution
- **Status Indicators**: Visual feedback for save status

## National Identity System

### Custom Field Support

The National Identity section supports custom field entry in all 26 fields:

- **Basic Information**: Country name, official name, capital city, government type
- **Cultural Identity**: Motto, anthem, religion, languages, national day
- **Technical Details**: Currency, TLD, ISO codes, coordinates, time zones
- **Geographic Data**: Driving side, postal codes, emergency numbers

### Field Types

1. **Autocomplete Fields**: Capital city, currency, languages, time zones
2. **Freeform Text**: All fields accept custom text input
3. **Custom Government Types**: User-defined government types with persistence
4. **Field Suggestions**: Autocomplete powered by user-submitted values

### Autosave Behavior

#### Create Mode
- LocalStorage autosave every 500ms
- No database autosave (data saved on final submission)
- Draft recovery across page refreshes

#### Edit Mode
- LocalStorage autosave every 500ms
- Database autosave every 15 seconds for National Identity
- Real-time sync with conflict detection
- Visual status indicators (Saving, Saved, Pending, Error)

## API Endpoints

### National Identity Router

```
POST /api/nationalIdentity/autosave
- Debounced autosave (15s)
- Upsert logic (create or update)
- Ownership validation

PUT /api/nationalIdentity/update
- Manual save operations
- Field-level updates
- Ownership validation

GET /api/nationalIdentity/getByCountryId
- Retrieve national identity data
- Ownership validation

POST /api/nationalIdentity/create
- Create new national identity record
- Ownership validation
```

### Field Mapping

All 26 National Identity fields are properly mapped:

```typescript
interface NationalIdentityData {
  countryName: string;
  officialName: string;
  governmentType: string;
  motto: string;
  mottoNative: string;
  capitalCity: string;
  largestCity: string;
  demonym: string;
  currency: string;
  currencySymbol: string;
  officialLanguages: string;
  nationalLanguage: string;
  nationalAnthem: string;
  nationalReligion: string; // ✅ Added in v1.1.1
  nationalDay: string;
  callingCode: string;
  internetTLD: string;
  drivingSide: string;
  timeZone: string;
  isoCode: string;
  coordinatesLatitude: string;
  coordinatesLongitude: string;
  emergencyNumber: string;
  postalCodeFormat: string;
  nationalSport: string;
  weekStartDay: string;
}
```

## Error Handling & Recovery

### LocalStorage Failures

1. **Primary**: localStorage with mutex protection
2. **Fallback**: sessionStorage for temporary persistence
3. **Recovery**: Automatic state restoration from sessionStorage
4. **Logging**: Comprehensive error logging and user notifications

### Database Autosave Failures

1. **Retry Logic**: Built-in retry mechanisms
2. **Conflict Resolution**: Automatic conflict detection and resolution
3. **Status Feedback**: Visual indicators for save status
4. **Error Recovery**: Graceful degradation with user notifications

## Troubleshooting Guide

### Common Issues

#### "Save failed" Status
- **Cause**: Network issues or server errors
- **Solution**: Check network connection, retry manually
- **Prevention**: Data is preserved in localStorage

#### "Pending" Status Persists
- **Cause**: Autosave debounce timer not triggered
- **Solution**: Make a small change to trigger autosave
- **Prevention**: Manual save available in editor

#### Data Loss on Page Refresh
- **Cause**: localStorage disabled or full
- **Solution**: Check browser settings, clear storage
- **Prevention**: Automatic sessionStorage fallback

#### Autosave Not Working
- **Cause**: JavaScript disabled or network issues
- **Solution**: Enable JavaScript, check network
- **Prevention**: Manual save always available

### Debug Information

Enable debug logging by setting:
```javascript
localStorage.setItem('debug_builder', 'true');
```

This will log:
- Autosave operations
- localStorage/sessionStorage fallbacks
- Database sync status
- Error details

### Performance Optimization

1. **Debouncing**: Prevents excessive API calls
2. **Mutex Protection**: Prevents localStorage race conditions
3. **Selective Updates**: Only changed fields are synced
4. **Background Sync**: Non-blocking autosave operations

## Development Notes

### Adding New Fields

1. Add to `NationalIdentityData` interface
2. Update form components with new field
3. Add to `createCountry` mutation mapping
4. Update edit mode loading in `useBuilderState`
5. Test autosave functionality

### Modifying Autosave Behavior

1. Update debounce timers in hooks
2. Modify status indicators in components
3. Test conflict resolution scenarios
4. Update error handling logic

### Testing Autosave

1. **Create Mode**: Verify localStorage persistence
2. **Edit Mode**: Verify database autosave
3. **Network Issues**: Test offline/online scenarios
4. **Storage Issues**: Test localStorage/sessionStorage fallbacks
5. **Conflict Resolution**: Test concurrent editing scenarios

## Version History

### v1.1.1 (Current)
- ✅ Added nationalReligion field to UI and database
- ✅ Implemented National Identity autosave system
- ✅ Added visual autosave status indicators
- ✅ Enhanced localStorage recovery mechanisms
- ✅ Fixed editor save mapping for national identity
- ✅ Added comprehensive error handling

### v1.1.0
- ✅ Basic autosave for government and tax systems
- ✅ LocalStorage draft persistence
- ✅ Edit mode data loading
- ✅ Custom field support for all national identity fields

## Success Criteria

### Production Readiness Checklist

- [x] All 26 National Identity fields support custom entry
- [x] LocalStorage autosave (500ms) working reliably
- [x] Database autosave (15s) for National Identity
- [x] Visual autosave status indicators
- [x] Error handling and recovery mechanisms
- [x] Edit mode data loading for all fields
- [x] Create mode field persistence
- [x] Conflict resolution for concurrent edits
- [x] Performance optimization (debouncing, mutex)
- [x] Comprehensive error logging

### Quality Assurance

- [x] TypeScript type safety (100% coverage)
- [x] Linting compliance (0 errors)
- [x] Build validation (passes)
- [x] API endpoint security (ownership validation)
- [x] Data integrity (upsert operations)
- [x] User experience (visual feedback)
- [x] Error resilience (fallback mechanisms)

The IxStats Builder System now provides production-grade autosave functionality with comprehensive error handling, visual feedback, and robust data persistence across all supported scenarios.
