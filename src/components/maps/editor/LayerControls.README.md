# LayerControls Component

A comprehensive, accessible layer management component for the IxStats Map Editor. Features a floating glass-panel design with full control over map layer visibility, filtering, and opacity settings.

## Features

### Core Functionality
- **Layer Visibility Toggle** - Show/hide boundaries, subdivisions, cities, and POIs
- **Subdivision Level Filtering** - Filter by administrative levels 1-5
- **City Type Filtering** - Filter by capital, city, town, village
- **POI Category Filtering** - 6 main categories with 46 subcategories
- **Opacity Control** - Adjust transparency for each layer (0-100%)
- **Quick Actions** - Show All, Hide All, Reset to Default buttons

### User Experience
- **Collapsible Panel** - Toggle button to show/hide the controls
- **Smooth Animations** - 300ms transitions for panel and 200ms for interactions
- **Search Functionality** - Search across all 46 POI subcategories
- **Expandable Categories** - POI categories expand to show subcategory details
- **Select All/Clear All** - Bulk selection controls for each filter section
- **Responsive Design** - Full-width drawer on mobile, fixed panel on desktop

### Design System
- **Glass Physics** - Backdrop blur with hierarchical depth
- **Blue Accent Theme** - Consistent with IxStats design system
- **Lucide Icons** - Professional icon library integration
- **Tailwind CSS v4** - Modern styling with custom utilities

### Accessibility
- **ARIA Labels** - Complete semantic markup for screen readers
- **Keyboard Navigation** - Full keyboard control (Tab, Space, Enter)
- **Focus Indicators** - Clear visual focus states
- **Role Attributes** - Proper ARIA roles for all interactive elements
- **Screen Reader Friendly** - Descriptive labels and status updates

## Installation

The component is already integrated into the map editor components. Import it from the barrel export:

```typescript
import { LayerControls } from "~/components/maps/editor";
```

## Props Interface

```typescript
interface LayerControlsProps {
  /** Visibility state for each layer type */
  layers: {
    boundaries: boolean;
    subdivisions: boolean;
    cities: boolean;
    pois: boolean;
  };

  /** Callback when layer visibility changes */
  onLayerToggle: (layer: keyof typeof layers, visible: boolean) => void;

  /** Active subdivision levels (1-5) */
  subdivisionLevel?: number[];

  /** Callback when subdivision level filter changes */
  onSubdivisionLevelChange?: (levels: number[]) => void;

  /** Active city types */
  cityTypes?: string[];

  /** Callback when city type filter changes */
  onCityTypeChange?: (types: string[]) => void;

  /** Active POI categories */
  poiCategories?: string[];

  /** Callback when POI category filter changes */
  onPoiCategoryChange?: (categories: string[]) => void;

  /** Opacity settings for each layer (0-100) */
  opacity?: Record<string, number>;

  /** Callback when layer opacity changes */
  onOpacityChange?: (layer: string, opacity: number) => void;
}
```

## Usage

### Basic Example

```typescript
import { useState } from "react";
import { LayerControls } from "~/components/maps/editor";

function MapEditor() {
  const [layers, setLayers] = useState({
    boundaries: true,
    subdivisions: true,
    cities: true,
    pois: true,
  });

  const handleLayerToggle = (layer, visible) => {
    setLayers((prev) => ({ ...prev, [layer]: visible }));
  };

  return (
    <div className="relative h-screen">
      {/* Your map component */}
      <MapCanvas layers={layers} />

      {/* Layer controls */}
      <LayerControls layers={layers} onLayerToggle={handleLayerToggle} />
    </div>
  );
}
```

### Full Example with All Features

See `LayerControls.example.tsx` for a complete working example with:
- State management for all filter types
- Integration with map rendering
- localStorage persistence
- Performance optimization tips

## Component Structure

### Main Panel
- **Toggle Button** - Fixed position (right-4, top-24, z-10)
- **Glass Panel** - Slides in from right with smooth animation
- **Collapsible Sections** - Organized by functionality

### Sections

#### 1. Quick Actions
- Show All Layers
- Hide All Layers
- Reset to Default

#### 2. Layer Visibility
- Toggle switches for each layer
- Eye/EyeOff icons for visual feedback
- Active state indicators

#### 3. Subdivision Levels (when subdivisions visible)
- Checkboxes for levels 1-5
- Descriptive labels (e.g., "Level 1 (States/Provinces)")
- Select All / Clear All buttons

#### 4. City Types (when cities visible)
- Checkboxes with type-specific icons
- Capital (Crown), City (Building2), Town (Home), Village (House)
- Select All / Clear All buttons

#### 5. Points of Interest (when POIs visible)
- Search bar for subcategories
- 6 main categories with color indicators
- Expandable subcategory lists (46 items)
- Category counts and details
- Select All / Clear All buttons

#### 6. Layer Opacity
- Range sliders (0-100%) for each layer
- Real-time value display
- Reset to 100% button
- Disabled state when layer is hidden

## POI Taxonomy Integration

The component integrates with `~/lib/poi-taxonomy.ts` to display:

### Main Categories (6)
1. **Civilian & Cultural** (Blue) - 10 subcategories
2. **Military & Defense** (Red) - 8 subcategories
3. **Natural Features** (Green) - 8 subcategories
4. **Infrastructure & Transport** (Gray) - 8 subcategories
5. **Commercial & Economic** (Orange) - 7 subcategories
6. **Government & Services** (Slate) - 5 subcategories

### Subcategory Features
- Searchable across all 46 subcategories
- Expandable category views
- Color-coded by main category
- Icon indicators from lucide-react

## Styling

### Glass Panel Design
```css
/* Applied automatically via glass-panel class */
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.9);
border: 1px solid rgba(255, 255, 255, 0.2);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
```

### Active State
```css
/* Applied via glass-interactive class */
background: rgba(59, 130, 246, 0.1);
color: rgb(30, 64, 175);
```

### Custom Slider Styling
- Custom thumb design with hover effects
- Gradient track showing current value
- Smooth transitions (200ms)
- Disabled state styling

## Responsive Behavior

### Desktop (≥768px)
- Fixed panel: 320px width
- Right-side positioning
- Smooth slide-in animation

### Mobile (<768px)
- Full-width drawer
- Collapsed by default
- Touch-friendly controls
- Optimized spacing

## Accessibility Features

### Keyboard Navigation
- **Tab** - Navigate between controls
- **Space/Enter** - Toggle checkboxes and buttons
- **Arrow Keys** - Adjust slider values

### Screen Reader Support
- Descriptive ARIA labels on all controls
- Status announcements for state changes
- Proper heading hierarchy
- Role attributes for custom controls

### Focus Management
- Clear focus indicators
- Logical focus order
- Focus trap when panel is open
- Return focus on close

## Performance Considerations

### Optimizations
- React.memo on internal components
- useCallback for event handlers
- useMemo for filtered data
- Conditional rendering for sections

### Best Practices
- Debounce opacity changes if map rendering is expensive
- Memoize filtered map data
- Use virtual scrolling for large POI lists (if needed)

## Integration Tips

### 1. State Management
```typescript
// Use a reducer for complex state
const [state, dispatch] = useReducer(layerReducer, initialState);

// Or context for app-wide layer state
const LayerContext = createContext();
```

### 2. Persistence
```typescript
// Save to localStorage
useEffect(() => {
  localStorage.setItem("mapLayers", JSON.stringify(layers));
}, [layers]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem("mapLayers");
  if (saved) setLayers(JSON.parse(saved));
}, []);
```

### 3. Map Integration
```typescript
// Filter data based on active settings
const visibleSubdivisions = subdivisions.filter(
  (s) => subdivisionLevels.includes(s.level)
);

const visibleCities = cities.filter((c) => cityTypes.includes(c.type));

const visiblePOIs = pois.filter((p) =>
  poiCategories.includes(p.category)
);

// Apply opacity
<Layer opacity={opacity.subdivisions / 100} />
```

### 4. Performance
```typescript
// Debounce expensive updates
const debouncedOpacityChange = useMemo(
  () => debounce(handleOpacityChange, 100),
  [handleOpacityChange]
);
```

## Customization

### Adding New Layer Types
```typescript
// 1. Add to layers object
layers: {
  boundaries: boolean;
  subdivisions: boolean;
  cities: boolean;
  pois: boolean;
  roads: boolean; // New layer
}

// 2. Add to LayerToggle section
<LayerToggle
  label="Roads"
  visible={layers.roads}
  onToggle={(v) => onLayerToggle("roads", v)}
/>

// 3. Add to opacity section
<OpacitySlider
  label="Roads"
  value={opacity.roads ?? 100}
  onChange={(v) => handleOpacityChange("roads", v)}
  disabled={!layers.roads}
/>
```

### Custom Section
```typescript
// Add custom filtering section
<Section
  title="Custom Filter"
  isExpanded={expandedSections.has("custom")}
  onToggle={() => toggleSection("custom")}
>
  {/* Your custom controls */}
</Section>
```

## Troubleshooting

### Panel Not Appearing
- Check z-index conflicts (panel uses z-10)
- Ensure parent container allows fixed positioning
- Verify glass-panel class is defined in CSS

### Filters Not Working
- Verify callback props are provided
- Check that state updates are propagated to map
- Console.log state changes to debug

### Performance Issues
- Implement debouncing for rapid changes
- Use React.memo on map components
- Check for unnecessary re-renders

### Styling Issues
- Ensure Tailwind CSS v4 is properly configured
- Check for CSS conflicts with other components
- Verify glass-panel utilities are defined

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 10+)

## Dependencies

- React 18+
- lucide-react (icons)
- Tailwind CSS v4
- Next.js 15 (for client components)

## Related Components

- `MapEditorContainer` - Main map editor wrapper
- `EditorSidebar` - Left-side editing tools
- `EditorToolbar` - Top toolbar actions
- `POIEditor` - POI creation and editing
- `SubdivisionEditor` - Subdivision management
- `CityPlacement` - City placement tools

## Future Enhancements

- [ ] Preset layer configurations (Urban, Natural, Political)
- [ ] Export/import layer settings as JSON
- [ ] Layer groups for bulk operations
- [ ] Advanced POI filtering (by attributes)
- [ ] Layer ordering/z-index control
- [ ] Animation speed controls
- [ ] Color customization for categories
- [ ] Layer visibility history (undo/redo)

## License

Part of the IxStats project. See project root for license information.
