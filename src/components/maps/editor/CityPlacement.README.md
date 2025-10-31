# CityPlacement Component

A comprehensive React component for placing and managing city markers on interactive maps within the IxStats platform.

## Overview

The `CityPlacement` component provides a complete user interface for:
- **Interactive city marker placement** via map clicks
- **Comprehensive metadata forms** with validation
- **Auto-detection of subdivisions** based on coordinates
- **Type-specific marker styling** (capital, city, town, village)
- **Draft and review workflow** integration
- **Glass physics styling** following IxStats design system

## Features

### 1. Point Placement Tool
- Click-to-place marker on map
- Move marker functionality
- Real-time coordinate display (lat/lng to 6 decimal places)
- Visual marker preview with type-specific icons

### 2. City Metadata Form
All fields with proper validation:
- **Name** (required, 1-200 characters)
- **Type** dropdown (capital, city, town, village)
- **Population** (optional, numeric)
- **Elevation** (optional, meters)
- **Founded Year** (optional, 4-digit year)
- **Is National Capital** checkbox
- **Is Subdivision Capital** checkbox
- **Description** (optional, textarea)

### 3. Smart Validation
- Coordinates must be within country bounds
- Only one national capital per country
- Numeric fields validated for proper format
- Year validation (0 to current year)
- Real-time error display with field-specific messaging

### 4. Marker Styling
Different icons and sizes based on city type:
- **Capital/National Capital**: Crown icon (larger, yellow)
- **City**: Building icon (medium, blue)
- **Town**: Home icon (small)
- **Village**: House icon (smallest)

### 5. Context-Aware Features
- Distance calculation to nearest city
- Out-of-bounds warning
- Subdivision auto-detection (ready for point-in-polygon integration)
- National capital conflict detection

### 6. Actions
- **Save as Draft**: Store city data without approval
- **Submit for Review**: Send to admin queue
- **Update Draft**: Modify existing draft cities
- **Delete**: Remove city marker
- **Move**: Reposition existing marker

## Installation

The component is already integrated into the IxStats map editor system. Import from the barrel export:

```typescript
import { CityPlacement } from "~/components/maps/editor";
```

## Usage

### Basic Example

```tsx
import { CityPlacement } from "~/components/maps/editor";

function MapEditor() {
  return (
    <div className="flex h-screen">
      {/* Your map component */}
      <div className="flex-1">
        <MapComponent />
      </div>

      {/* City placement sidebar */}
      <div className="w-96">
        <CityPlacement
          countryId="user-country-id"
          countryBounds={{
            minLat: 35.0,
            maxLat: 42.0,
            minLng: -10.0,
            maxLng: -5.0,
          }}
        />
      </div>
    </div>
  );
}
```

### With Event Handlers

```tsx
function MapEditor() {
  const handleCityPlaced = (city) => {
    console.log("New city placed:", city);
    // Update map markers
  };

  const handleCityUpdated = (city) => {
    console.log("City updated:", city);
    // Update map markers
  };

  const handleCityDeleted = (cityId) => {
    console.log("City deleted:", cityId);
    // Remove map marker
  };

  return (
    <CityPlacement
      countryId="user-country-id"
      countryBounds={{
        minLat: 35.0,
        maxLat: 42.0,
        minLng: -10.0,
        maxLng: -5.0,
      }}
      onCityPlaced={handleCityPlaced}
      onCityUpdated={handleCityUpdated}
      onCityDeleted={handleCityDeleted}
    />
  );
}
```

### Editing Existing City

```tsx
function EditCityMode() {
  const existingCity = {
    id: "city-123",
    lat: 38.7223,
    lng: -9.1393,
    formData: {
      name: "Lisbon",
      type: "capital",
      population: "504718",
      elevation: "2",
      foundedYear: "1200",
      isNationalCapital: true,
      isSubdivisionCapital: false,
      description: "Capital of Portugal",
    },
    status: "draft",
  };

  return (
    <CityPlacement
      countryId="portugal-id"
      initialCity={existingCity}
    />
  );
}
```

## Props

### CityPlacementProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `countryId` | `string` | Yes | ID of the country where city is being placed |
| `countryBounds` | `object` | No | Geographic bounds for validation (minLat, maxLat, minLng, maxLng) |
| `onCityPlaced` | `function` | No | Callback when new city is created |
| `onCityUpdated` | `function` | No | Callback when city is updated |
| `onCityDeleted` | `function` | No | Callback when city is deleted |
| `initialCity` | `CityMarker` | No | Pre-populate form with existing city data |

### CityMarker Interface

```typescript
interface CityMarker {
  id?: string;
  lat: number;
  lng: number;
  formData: CityFormData;
  subdivisionId?: string | null;
  status?: "draft" | "pending" | "approved" | "rejected";
}
```

### CityFormData Interface

```typescript
interface CityFormData {
  name: string;
  type: "capital" | "city" | "town" | "village";
  population: string;
  elevation: string;
  foundedYear: string;
  isNationalCapital: boolean;
  isSubdivisionCapital: boolean;
  description: string;
}
```

## Integration with Map Libraries

### Leaflet.js Integration

```tsx
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { CityPlacement } from '~/components/maps/editor';

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CityPlacementMap() {
  const cityPlacementRef = useRef<any>(null);

  const handleMapClick = (lat: number, lng: number) => {
    // Trigger city placement component to handle click
    // You'd need to expose a method in CityPlacement for this
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        <MapContainer center={[38.5, -7.5]} zoom={7}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} />
        </MapContainer>
      </div>
      <div className="w-96">
        <CityPlacement
          ref={cityPlacementRef}
          countryId="country-123"
        />
      </div>
    </div>
  );
}
```

### MapLibre GL JS Integration

```tsx
import maplibregl from 'maplibre-gl';
import { CityPlacement } from '~/components/maps/editor';

function CityPlacementMapLibre() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [clickCoords, setClickCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-7.5, 38.5],
      zoom: 7,
    });

    map.current.on('click', (e) => {
      setClickCoords({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="flex h-screen">
      <div ref={mapContainer} className="flex-1" />
      <div className="w-96">
        <CityPlacement
          countryId="country-123"
          // Pass clickCoords to trigger placement
        />
      </div>
    </div>
  );
}
```

## API Integration

The component uses the following tRPC endpoints:

### Queries
- `api.mapEditor.getCountryCities.useQuery()` - Fetch existing cities
- `api.mapEditor.getCountrySubdivisions.useQuery()` - Fetch subdivisions for auto-detection

### Mutations
- `api.mapEditor.createCity.useMutation()` - Create new city
- `api.mapEditor.updateCity.useMutation()` - Update existing city
- `api.mapEditor.deleteCity.useMutation()` - Delete city
- `api.mapEditor.submitCityForReview.useMutation()` - Submit for admin review

## Styling

The component uses IxStats glass physics design system:

- **Glass panels**: `glass-panel` - Main container styling
- **Glass hierarchy**: `glass-hierarchy-child` - Nested sections
- **Glass interactive**: `glass-interactive` - Interactive elements

### Custom Styling

Override with Tailwind classes:

```tsx
<CityPlacement
  countryId="country-123"
  className="custom-styles"
/>
```

## Validation Rules

### Name
- Required field
- 1-200 characters
- Trimmed whitespace

### Population
- Optional
- Must be numeric
- Cannot be negative

### Elevation
- Optional
- Must be numeric (meters)

### Founded Year
- Optional
- Must be 4-digit number
- Range: 0 to current year

### National Capital
- Only one per country
- Automatically enforces uniqueness
- Checkbox disabled if country has existing capital

### Coordinates
- Must be within country bounds (if provided)
- Displayed to 6 decimal places (~10cm accuracy)

## Error Handling

The component provides comprehensive error messaging:

- **Field-level errors**: Red border + error text below field
- **Form-level errors**: Alert banner at bottom
- **Network errors**: Automatic retry with error display
- **Validation errors**: Real-time feedback on blur/change

## Accessibility

- Proper ARIA labels on all form fields
- `aria-invalid` on fields with errors
- Keyboard navigation support
- Focus management
- Screen reader announcements

## Performance

- **React.memo**: Memoized sub-components (not yet implemented, can be added)
- **useMemo**: Cached computed values (hasNationalCapital, isOutOfBounds, nearestCity)
- **useCallback**: Stable function references
- **Optimized re-renders**: Only updates when necessary

## Future Enhancements

### Planned Features
1. **Point-in-polygon detection** for automatic subdivision assignment
2. **Batch city import** from CSV/GeoJSON
3. **City clustering** for dense urban areas
4. **Historical timeline** for founded year visualization
5. **Image upload** for city photos
6. **Wikipedia integration** for auto-fill data

### Technical Improvements
1. Expose `handleMapClick` method via ref
2. Add undo/redo functionality
3. Implement local draft storage (IndexedDB)
4. Add map marker sync methods
5. Real-time collaboration support

## Troubleshooting

### Common Issues

**Cities not saving**
- Check that countryId is valid
- Verify user has permission to edit country
- Ensure coordinates are within bounds

**National capital checkbox disabled**
- Country already has a national capital
- Check existing cities for capital designation

**Validation errors persisting**
- Check all required fields are filled
- Verify numeric fields contain only numbers
- Ensure year is 4 digits

**Map clicks not registering**
- Verify map click handler is connected
- Check CityPlacement is in correct mode (place/move)
- Ensure proper event propagation

## Contributing

When extending this component:

1. Maintain glass physics styling
2. Follow IxStats TypeScript patterns
3. Add comprehensive JSDoc comments
4. Include validation for new fields
5. Update this README with new features

## License

Part of the IxStats platform. See main project LICENSE.

## Related Components

- `SubdivisionEditor` - For editing administrative divisions
- `POIEditor` - For placing points of interest
- `MapEditorContainer` - Main map editor wrapper
- `EditorToolbar` - Map editing toolbar
- `EditorSidebar` - Map editing sidebar

## Support

For issues or questions:
1. Check this README
2. Review example files in the same directory
3. Consult API_REFERENCE.md for tRPC endpoints
4. Check DESIGN_SYSTEM.md for styling guidelines
