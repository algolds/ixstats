# Border Editing System Documentation

## Overview

The Border Editing System provides advanced tools for managing country territorial boundaries in the IxStats maps platform. Built with MapLibre-Geoman, it offers professional-grade polygon editing capabilities with real-time validation and economic impact analysis.

## Architecture

### Components

#### 1. BorderEditor (`src/components/maps/editing/BorderEditor.tsx`)
Core editing component that integrates MapLibre-Geoman drawing tools.

**Features:**
- Polygon drawing and editing tools
- Vertex snapping (configurable distance)
- Self-intersection prevention
- Undo/Redo support
- Territory splitting and merging
- Real-time geometry updates

**Props:**
```typescript
interface BorderEditorProps {
  map: MapLibreMap | null;
  isActive: boolean;
  initialFeature?: Feature<Polygon | MultiPolygon> | null;
  onGeometryChange?: (feature: Feature<Polygon | MultiPolygon>) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  options?: {
    snapping?: boolean;
    snapDistance?: number;
    allowSelfIntersection?: boolean;
    continueDrawing?: boolean;
  };
}
```

**Usage:**
```tsx
import { BorderEditor } from "~/components/maps/editing/BorderEditor";

<BorderEditor
  map={mapInstance}
  isActive={isEditing}
  initialFeature={countryGeometry}
  onGeometryChange={handleGeometryUpdate}
  options={{
    snapping: true,
    snapDistance: 20,
    allowSelfIntersection: false,
  }}
/>
```

#### 2. TerritoryManager (`src/components/maps/admin/TerritoryManager.tsx`)
Admin interface for managing border edits with validation and approval workflow.

**Features:**
- Country selection interface
- Real-time validation display
- Economic impact preview
- Overlap detection warnings
- Change history viewer
- Approval workflow UI

**Props:**
```typescript
interface TerritoryManagerProps {
  map: MapLibreMap | null;
  isAdmin: boolean;
  currentUserId: string;
}
```

**Usage:**
```tsx
import { TerritoryManager } from "~/components/maps/admin/TerritoryManager";

<TerritoryManager
  map={mapInstance}
  isAdmin={userRole >= 90}
  currentUserId={user.id}
/>
```

### Hooks

#### useBorderEditor (`src/hooks/maps/useBorderEditor.ts`)
State management hook for border editing operations.

**Returns:**
```typescript
{
  state: BorderEditorState;     // Current editor state
  actions: BorderEditorActions; // Editor control actions
  isSaving: boolean;            // Save operation status
  canUndo: boolean;             // Undo availability
  canRedo: boolean;             // Redo availability
}
```

**Actions:**
- `startEditing(countryId, countryName, geometry)` - Begin editing session
- `stopEditing()` - End editing session
- `updateGeometry(geometry)` - Update current geometry
- `saveChanges(reason)` - Persist changes to database
- `cancelChanges()` - Discard unsaved changes
- `togglePreview()` - Toggle preview mode
- `undo()` - Undo last change
- `redo()` - Redo last undone change
- `validateCurrent()` - Validate current geometry

**Example:**
```tsx
const { state, actions, isSaving, canUndo, canRedo } = useBorderEditor(map, {
  population: 1000000,
  gdp: 50000000,
  areaKm2: 100000,
});

// Start editing
actions.startEditing("country-id", "Country Name", geometryFeature);

// Handle geometry updates
const handleUpdate = (newGeometry) => {
  actions.updateGeometry(newGeometry);
};

// Save with reason
await actions.saveChanges("Territorial adjustment following treaty");
```

### Utilities

#### Border Validation (`src/lib/maps/border-validation.ts`)

**Functions:**

1. **validateBorderGeometry(feature)**
   - Structural integrity validation
   - Self-intersection detection
   - Coordinate validity checks
   - Returns: `BorderValidationResult`

2. **calculateGeometryMetrics(feature)**
   - Area calculation (km² and sq mi)
   - Perimeter calculation
   - Vertex/ring counting
   - Returns geometry metrics object

3. **calculateEconomicImpact(oldArea, newArea, population, gdp)**
   - Population density changes
   - GDP impact estimation
   - Per capita calculations
   - Returns: `EconomicImpact`

4. **checkBorderOverlaps(newFeature, existingCountries)**
   - Bounding box intersection detection
   - Overlap area estimation
   - Returns: `OverlapDetectionResult`

**Example:**
```typescript
import {
  validateBorderGeometry,
  calculateEconomicImpact,
  checkBorderOverlaps,
} from "~/lib/maps/border-validation";

// Validate geometry
const validation = validateBorderGeometry(feature);
if (!validation.isValid) {
  console.error("Validation errors:", validation.errors);
}

// Calculate economic impact
const impact = calculateEconomicImpact(
  oldAreaKm2,
  newAreaKm2,
  population,
  gdp
);
console.log(`Area change: ${impact.areaChange.percentChange}%`);
console.log(`Population impact: ${impact.populationImpact.estimatedChange}`);

// Check overlaps
const overlaps = checkBorderOverlaps(feature, otherCountries);
if (overlaps.hasOverlap) {
  console.warn("Overlaps detected:", overlaps.overlappingCountries);
}
```

## API Endpoints

### geo.updateCountryBorder

Updates a country's border geometry with validation and history tracking.

**Input:**
```typescript
{
  countryId: string;
  geometry: GeoJSONGeometry;
  reason: string;              // Min 10 chars, max 500
  checkOverlaps?: boolean;     // Default: true
}
```

**Output:**
```typescript
{
  success: boolean;
  country: {
    id: string;
    name: string;
    newAreaSqMi: number;
    oldAreaSqMi: number;
    areaDeltaSqMi: number;
    centroid: { lng: number; lat: number };
    boundingBox: { minLng, minLat, maxLng, maxLat };
  };
}
```

**Authorization:** Admin only (`adminProcedure`)

**Validation:**
- Geometry structure validation
- Self-intersection checks
- Overlap detection (if enabled)
- Area change significance threshold (5%)

**Side Effects:**
- Creates entry in `BorderHistory` table
- Recalculates dependent metrics:
  - `landArea` (km²)
  - `areaSqMi`
  - `populationDensity`
  - `gdpDensity`
  - `centroid`
  - `boundingBox`

### geo.getBorderHistory

Retrieves border change history for a country.

**Input:**
```typescript
{
  countryId: string;
  limit?: number;    // Default: 20, max: 100
  offset?: number;   // Default: 0
}
```

**Output:**
```typescript
{
  history: Array<{
    id: string;
    geometry: GeoJSON;
    changedBy: string;
    changedAt: string;
    reason: string;
    oldAreaSqMi: number;
    newAreaSqMi: number;
    areaDeltaSqMi: number;
    percentChange: number | null;
  }>;
  total: number;
  hasMore: boolean;
  country: {
    id: string;
    name: string;
  };
}
```

**Authorization:** Country owner or admin (`protectedProcedure` with permission check)

## Security & Permissions

### Access Control

1. **Border Editing**
   - Requires admin role (level >= 90)
   - Enforced at API level (`adminProcedure`)

2. **History Viewing**
   - Country owners can view their own history
   - Admins can view all country histories
   - Enforced via `protectedProcedure` with role check

3. **Validation Requirements**
   - All geometry changes must pass validation
   - Overlap detection mandatory (can be disabled with flag)
   - Change reason required (10-500 characters)

### Audit Trail

All border changes are logged to `BorderHistory` table:
- User who made the change (`changedBy`)
- Timestamp (`changedAt`)
- Reason for change (`reason`)
- Old and new geometry
- Area metrics and deltas

## Integration Guide

### 1. Basic Integration

Add the TerritoryManager to your maps page:

```tsx
// src/app/maps/admin/page.tsx
import { TerritoryManager } from "~/components/maps/admin/TerritoryManager";
import { useMapInstance } from "~/hooks/maps/useMapInstance";
import { useUser } from "@clerk/nextjs";

export default function MapsAdminPage() {
  const { user } = useUser();
  const { map } = useMapInstance();

  const isAdmin = user?.publicMetadata?.role >= 90;

  return (
    <div className="h-screen flex">
      <div className="flex-1">
        {/* Your map component */}
      </div>
      <div className="w-96">
        <TerritoryManager
          map={map}
          isAdmin={isAdmin}
          currentUserId={user?.id || ""}
        />
      </div>
    </div>
  );
}
```

### 2. Custom Implementation

Use the hook and components separately for custom workflows:

```tsx
import { useBorderEditor } from "~/hooks/maps/useBorderEditor";
import { BorderEditor } from "~/components/maps/editing/BorderEditor";

function CustomBorderEditor({ map, countryData }) {
  const { state, actions, isSaving } = useBorderEditor(map, {
    population: countryData.population,
    gdp: countryData.gdp,
    areaKm2: countryData.areaKm2,
  });

  return (
    <div>
      <button onClick={() => actions.startEditing(...)}>
        Edit Borders
      </button>

      {state.isEditing && (
        <>
          <BorderEditor
            map={map}
            isActive={state.isEditing}
            initialFeature={state.currentGeometry}
            onGeometryChange={actions.updateGeometry}
          />

          {state.validation && (
            <div>
              Status: {state.validation.isValid ? "Valid" : "Invalid"}
              Errors: {state.validation.errors.join(", ")}
            </div>
          )}

          <button
            onClick={() => actions.saveChanges("Border adjustment")}
            disabled={!state.validation?.isValid || isSaving}
          >
            Save Changes
          </button>
        </>
      )}
    </div>
  );
}
```

### 3. Keyboard Shortcuts

When editing is active:
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Escape` - Cancel editing

## Validation Rules

### Geometry Validation

1. **Type Validation**
   - Must be Polygon or MultiPolygon
   - Coordinates must be valid numbers

2. **Ring Validation**
   - Minimum 4 vertices (closed ring)
   - First and last vertices must match
   - No self-intersecting segments

3. **Coordinate Validation**
   - Longitude: -180 to 180
   - Latitude: -90 to 90
   - No NaN or Infinity values

4. **Area Validation**
   - Warning if < 1 km²
   - Warning if > 20M km² (larger than Russia)

5. **Performance Validation**
   - Warning if > 10,000 vertices per ring
   - Recommend simplification

### Overlap Detection

Client-side bounding box check + server-side validation:
- Quick intersection detection
- Detailed polygon intersection (server-side)
- Area calculation of overlaps
- List of conflicting countries

### Economic Impact

Estimates based on uniform density assumptions:
- Population change (uniform density)
- GDP change (uniform economic density)
- New density calculations
- GDP per capita adjustments

## Database Schema

### BorderHistory Table

```prisma
model BorderHistory {
  id             String    @id @default(cuid())
  countryId      String
  country        Country   @relation(fields: [countryId], references: [id])
  geometry       Json      // GeoJSON of previous border
  changedBy      String    // Clerk user ID
  changedAt      DateTime  @default(now())
  reason         String    // 10-500 characters
  oldAreaSqMi    Float
  newAreaSqMi    Float
  areaDeltaSqMi  Float

  @@index([countryId])
  @@index([changedAt])
}
```

## Performance Considerations

### Client-Side

1. **Geometry Simplification**
   - Simplify complex geometries for preview
   - Use full resolution for final save

2. **Validation Debouncing**
   - Debounce validation during active editing
   - Full validation on save

3. **Map Performance**
   - Use vector tiles for base layers
   - Limit editing layer complexity

### Server-Side

1. **PostGIS Optimization**
   - Use spatial indexes
   - ST_Simplify for large geometries
   - ST_IsValid for validation

2. **Caching**
   - Cache country boundaries
   - Cache bounding boxes
   - Invalidate on update

## Troubleshooting

### Common Issues

**1. MapLibre-Geoman not loading**
- Ensure `@geoman-io/maplibre-geoman-free` is installed
- Check for CSP issues blocking dynamic imports
- Verify MapLibre GL is initialized

**2. Validation errors**
- Check coordinate order (GeoJSON uses [lng, lat])
- Ensure rings are properly closed
- Verify no self-intersections

**3. Save failures**
- Verify admin permissions
- Check change reason length (min 10 chars)
- Ensure geometry passes validation
- Check for overlap conflicts

**4. Performance issues**
- Simplify complex geometries
- Reduce vertex count
- Use appropriate zoom levels

## Future Enhancements

### Planned Features

1. **Advanced Tools**
   - Bezier curve smoothing
   - Automatic simplification
   - Snap to existing borders
   - Territory templates

2. **Collaboration**
   - Multi-user editing
   - Change proposals
   - Approval workflows
   - Comment system

3. **Analysis**
   - Historical border overlays
   - Territory comparison
   - Dispute visualization
   - Treaty integration

4. **Import/Export**
   - Shapefile import
   - KML/KMZ support
   - GeoJSON export
   - Historical snapshots

## Support

For issues or questions:
- Check validation errors in TerritoryManager
- Review browser console for detailed errors
- Verify PostGIS installation for production
- Contact admin team for permission issues

## License

Part of the IxStats platform. Internal use only.
