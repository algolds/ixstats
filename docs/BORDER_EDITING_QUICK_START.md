# Border Editing System - Quick Start Guide

## Installation

The border editing system is already installed with MapLibre-Geoman:

```bash
npm install @geoman-io/maplibre-geoman-free
```

## Basic Usage

### 1. Admin Page Integration

The simplest way to use the border editing system is through the pre-built admin page:

```
/maps/admin
```

**Features:**
- Complete admin interface
- Country selection
- Real-time validation
- Economic impact preview
- Change history viewer
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Escape)

### 2. Custom Integration

For custom implementations, use the components directly:

```tsx
import { TerritoryManager } from "~/components/maps/admin/TerritoryManager";
import { useMapInstance } from "~/hooks/maps/useMapInstance";

function MyCustomPage() {
  const { map } = useMapInstance();

  return (
    <TerritoryManager
      map={map}
      isAdmin={true}
      currentUserId="user-id"
    />
  );
}
```

### 3. Programmatic Control

Use the hook for full programmatic control:

```tsx
import { useBorderEditor } from "~/hooks/maps/useBorderEditor";
import { BorderEditor } from "~/components/maps/editing/BorderEditor";

function CustomEditor({ map, countryData }) {
  const { state, actions, isSaving } = useBorderEditor(map, {
    population: countryData.population,
    gdp: countryData.gdp,
    areaKm2: countryData.areaKm2,
  });

  return (
    <div>
      {/* Start/Stop Controls */}
      {!state.isEditing ? (
        <button onClick={() => actions.startEditing(
          countryData.id,
          countryData.name,
          countryData.geometry
        )}>
          Edit Borders
        </button>
      ) : (
        <div>
          {/* Validation Status */}
          <div>
            Status: {state.validation?.isValid ? "✓ Valid" : "✗ Invalid"}
            {state.validation?.errors.map(error => (
              <div key={error}>{error}</div>
            ))}
          </div>

          {/* Economic Impact */}
          {state.economicImpact && (
            <div>
              Area Change: {state.economicImpact.areaChange.percentChange.toFixed(1)}%
              Population Impact: {state.economicImpact.populationImpact.estimatedChange}
            </div>
          )}

          {/* Controls */}
          <button onClick={actions.undo} disabled={!canUndo}>Undo</button>
          <button onClick={actions.redo} disabled={!canRedo}>Redo</button>

          {/* Save/Cancel */}
          <button
            onClick={() => actions.saveChanges("Border adjustment reason")}
            disabled={!state.validation?.isValid || isSaving}
          >
            Save Changes
          </button>
          <button onClick={actions.cancelChanges}>Cancel</button>
        </div>
      )}

      {/* Border Editor Component */}
      {state.isEditing && (
        <BorderEditor
          map={map}
          isActive={state.isEditing}
          initialFeature={state.currentGeometry}
          onGeometryChange={actions.updateGeometry}
          options={{
            snapping: true,
            snapDistance: 20,
            allowSelfIntersection: false,
          }}
        />
      )}
    </div>
  );
}
```

## Key Concepts

### 1. Validation

All geometry changes are validated:
- ✓ Valid GeoJSON structure
- ✓ Closed rings (first = last vertex)
- ✓ No self-intersections
- ✓ Valid coordinates (-180 to 180 lng, -90 to 90 lat)
- ✓ No overlaps with other countries

### 2. Economic Impact

Automatic calculation of:
- Area changes (km² and sq mi)
- Population impact (based on density)
- GDP changes (based on economic density)
- GDP per capita adjustments

### 3. History Tracking

All changes are logged:
- User who made the change
- Timestamp
- Reason (required, 10-500 chars)
- Old and new geometry
- Area metrics

### 4. Security

- Only admins can edit borders (role >= 90)
- Country owners can view their history
- All changes require a reason
- Validation is enforced server-side

## API Reference

### useBorderEditor Hook

```typescript
const {
  state: {
    isEditing: boolean;
    editingCountryId: string | null;
    editingCountryName: string | null;
    originalGeometry: Feature | null;
    currentGeometry: Feature | null;
    validation: BorderValidationResult | null;
    economicImpact: EconomicImpact | null;
    overlapDetection: OverlapDetectionResult | null;
    hasUnsavedChanges: boolean;
    isPreviewMode: boolean;
  },
  actions: {
    startEditing: (countryId, countryName, geometry) => void;
    stopEditing: () => void;
    updateGeometry: (geometry) => void;
    saveChanges: (reason) => Promise<void>;
    cancelChanges: () => void;
    togglePreview: () => void;
    undo: () => void;
    redo: () => void;
    validateCurrent: () => BorderValidationResult;
  },
  isSaving: boolean;
  canUndo: boolean;
  canRedo: boolean;
} = useBorderEditor(map, countryData);
```

### BorderEditor Component

```typescript
<BorderEditor
  map={mapInstance}                    // MapLibre map instance
  isActive={boolean}                   // Enable/disable editing
  initialFeature={Feature}             // Initial geometry
  onGeometryChange={(feature) => {}}   // Callback on changes
  onEditStart={() => {}}               // Callback on edit start
  onEditEnd={() => {}}                 // Callback on edit end
  options={{
    snapping: true,                    // Enable vertex snapping
    snapDistance: 20,                  // Snap distance in pixels
    allowSelfIntersection: false,      // Prevent self-intersection
    continueDrawing: false,            // Continue after finishing
  }}
/>
```

### Validation Functions

```typescript
import {
  validateBorderGeometry,
  calculateGeometryMetrics,
  calculateEconomicImpact,
  checkBorderOverlaps,
} from "~/lib/maps/border-validation";

// Validate geometry
const validation = validateBorderGeometry(feature);
// Returns: { isValid, errors[], warnings[], metrics }

// Calculate metrics
const metrics = calculateGeometryMetrics(feature);
// Returns: { areaKm2, areaSqMi, perimeterKm, vertexCount, ringCount }

// Calculate economic impact
const impact = calculateEconomicImpact(oldArea, newArea, population, gdp);
// Returns: { areaChange, populationImpact, economicImpact }

// Check overlaps
const overlaps = checkBorderOverlaps(feature, otherCountries);
// Returns: { hasOverlap, overlappingCountries[] }
```

## Common Patterns

### Pattern 1: Simple Edit with Validation

```tsx
const { state, actions } = useBorderEditor(map);

// Start editing
actions.startEditing(countryId, countryName, geometry);

// Check if valid before saving
if (state.validation?.isValid && !state.overlapDetection?.hasOverlap) {
  await actions.saveChanges("Border adjustment");
}
```

### Pattern 2: Preview Before Save

```tsx
const { state, actions } = useBorderEditor(map);

// Make changes...
actions.updateGeometry(newGeometry);

// Enable preview mode
actions.togglePreview();

// Review changes...

// Save or cancel
if (userConfirms) {
  await actions.saveChanges(reason);
} else {
  actions.cancelChanges();
}
```

### Pattern 3: Custom Validation

```tsx
import { validateBorderGeometry } from "~/lib/maps/border-validation";

const customValidation = (feature: Feature) => {
  const baseValidation = validateBorderGeometry(feature);

  // Add custom rules
  if (baseValidation.metrics.areaKm2 < minArea) {
    baseValidation.errors.push("Territory too small");
    baseValidation.isValid = false;
  }

  return baseValidation;
};
```

## Troubleshooting

### Problem: MapLibre-Geoman not loading
**Solution:** Check that the package is installed and MapLibre is initialized before rendering BorderEditor.

### Problem: Validation always fails
**Solution:** Ensure GeoJSON uses [lng, lat] order (not [lat, lng]) and rings are closed.

### Problem: Save button disabled
**Solution:** Check validation errors, ensure no overlaps, and provide a reason (min 10 chars).

### Problem: Can't undo changes
**Solution:** Undo only works after geometry updates. Check canUndo state.

### Problem: Performance issues with complex borders
**Solution:** Use geometry simplification or reduce vertex count. Check validation warnings.

## Next Steps

1. **Read full documentation:** `/docs/BORDER_EDITING_SYSTEM.md`
2. **Try the admin page:** `/maps/admin`
3. **Explore API endpoints:** `geo.updateCountryBorder`, `geo.getBorderHistory`
4. **Review validation logic:** `/src/lib/maps/border-validation.ts`
5. **Check examples:** `/src/components/maps/admin/TerritoryManager.tsx`

## Support

- Check validation errors in the UI
- Review console logs for detailed errors
- Verify admin permissions
- Ensure PostGIS is available (production)

For questions, contact the development team or file an issue.
