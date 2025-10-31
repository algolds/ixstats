# LayerControls Architecture

## Component Hierarchy

```
LayerControls (Main Container)
│
├── Toggle Button (Floating)
│   └── Layers Icon
│
└── Glass Panel (Collapsible)
    │
    ├── Header
    │   ├── Title
    │   └── Close Button
    │
    ├── Quick Actions
    │   ├── Show All Button
    │   ├── Hide All Button
    │   └── Reset to Default Button
    │
    ├── Layer Visibility Section
    │   └── LayerToggle × 4
    │       ├── Eye/EyeOff Icon
    │       └── Layer Name
    │
    ├── Subdivision Levels Section (Conditional)
    │   ├── Select All / Clear All
    │   └── Checkbox × 5
    │       └── Level Labels
    │
    ├── City Types Section (Conditional)
    │   ├── Select All / Clear All
    │   └── Checkbox × 4
    │       ├── Type Icon
    │       └── Type Label
    │
    ├── POI Categories Section (Conditional)
    │   ├── Select All / Clear All
    │   ├── Search Bar
    │   │   ├── Search Icon
    │   │   ├── Input Field
    │   │   └── Clear Button
    │   │
    │   ├── Search Results (Conditional)
    │   │   └── Result Items
    │   │
    │   └── Category List × 6
    │       ├── Checkbox
    │       ├── Color Indicator
    │       ├── Category Label
    │       ├── Expand Button
    │       └── Subcategory List (Expandable)
    │           └── Subcategory Items × 46
    │
    └── Opacity Section
        └── OpacitySlider × 4
            ├── Label + Value + Reset
            └── Range Input
```

## Component Files

```
/src/components/maps/editor/
├── LayerControls.tsx              # Main component (820 lines)
├── LayerControls.example.tsx      # Usage example (200 lines)
├── LayerControls.README.md        # Documentation
└── LayerControls.ARCHITECTURE.md  # This file
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Parent Component                        │
│  (e.g., MapEditorContainer, MapEditorWithLayerControls)    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Props
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      LayerControls                           │
│                                                              │
│  State:                                                      │
│  - isOpen: boolean                                          │
│  - expandedSections: Set<string>                            │
│  - expandedPOICategories: Set<string>                       │
│  - poiSearchQuery: string                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Callbacks
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      Event Handlers                          │
│                                                              │
│  - onLayerToggle(layer, visible)                            │
│  - onSubdivisionLevelChange(levels)                         │
│  - onCityTypeChange(types)                                  │
│  - onPoiCategoryChange(categories)                          │
│  - onOpacityChange(layer, opacity)                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Updates
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                      Map Rendering                           │
│                                                              │
│  - Filter subdivisions by level                             │
│  - Filter cities by type                                    │
│  - Filter POIs by category                                  │
│  - Apply layer visibility                                   │
│  - Apply layer opacity                                      │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Internal State (Component Level)
```typescript
// Panel visibility
const [isOpen, setIsOpen] = useState(true);

// Section expansion
const [expandedSections, setExpandedSections] = useState<Set<string>>(
  new Set(["visibility", "subdivisions", "cities", "pois", "opacity"])
);

// POI category expansion
const [expandedPOICategories, setExpandedPOICategories] = useState<Set<string>>(
  new Set()
);

// POI search
const [poiSearchQuery, setPoiSearchQuery] = useState("");
```

### External State (Props)
```typescript
// Layer visibility (required)
layers: {
  boundaries: boolean;
  subdivisions: boolean;
  cities: boolean;
  pois: boolean;
}

// Filtering (optional)
subdivisionLevel?: number[];      // [1, 2, 3, 4, 5]
cityTypes?: string[];             // ["capital", "city", "town", "village"]
poiCategories?: string[];         // ["civilian_cultural", ...]

// Styling (optional)
opacity?: Record<string, number>; // { boundaries: 100, ... }
```

## Sub-Components

### Section
**Purpose:** Collapsible section container with header
**Props:**
- `title: string` - Section heading
- `isExpanded: boolean` - Expansion state
- `onToggle: () => void` - Toggle callback
- `children: ReactNode` - Section content

**Styling:** Glass panel with border, hover effects

---

### LayerToggle
**Purpose:** Toggle button for layer visibility
**Props:**
- `label: string` - Layer name
- `visible: boolean` - Current visibility
- `onToggle: (visible: boolean) => void` - Change callback

**Features:**
- Eye/EyeOff icon based on state
- Blue active state styling
- ARIA pressed attribute

---

### Checkbox
**Purpose:** Reusable checkbox with optional icons
**Props:**
- `label: string` - Checkbox label
- `checked: boolean` - Check state
- `onToggle: () => void` - Toggle callback
- `icon?: ReactNode` - Optional left icon
- `colorIndicator?: string` - Optional color dot

**Features:**
- CheckSquare/Square icons
- Hover effects
- ARIA checkbox role

---

### OpacitySlider
**Purpose:** Range slider for layer opacity
**Props:**
- `label: string` - Layer name
- `value: number` - Current opacity (0-100)
- `onChange: (value: number) => void` - Change callback
- `disabled?: boolean` - Disable state

**Features:**
- Custom styled range input
- Real-time value display
- Reset to 100% button
- Gradient track visualization

## Integration with POI Taxonomy

```typescript
import {
  poiTaxonomy,           // Complete taxonomy object
  type POIMainCategoryKey,
  getMainCategories,     // Get all 6 main categories
  getSubcategories,      // Get subcategories for a category
} from "~/lib/poi-taxonomy";
```

### Main Categories (6)
```typescript
const mainCategories = getMainCategories();
// Returns:
// [
//   { key: "civilian_cultural", label: "Civilian & Cultural", color: "#3B82F6" },
//   { key: "military_defense", label: "Military & Defense", color: "#EF4444" },
//   { key: "natural_features", label: "Natural Features", color: "#22C55E" },
//   { key: "infrastructure_transport", label: "Infrastructure & Transport", color: "#6B7280" },
//   { key: "commercial_economic", label: "Commercial & Economic", color: "#F97316" },
//   { key: "government_services", label: "Government & Services", color: "#475569" }
// ]
```

### Subcategories (46 Total)
```typescript
const subcategories = getSubcategories("civilian_cultural");
// Returns:
// [
//   { key: "landmark", label: "Landmark", icon: "Landmark" },
//   { key: "monument", label: "Monument", icon: "Monument" },
//   { key: "museum", label: "Museum", icon: "Library" },
//   // ... 7 more subcategories
// ]
```

## Styling System

### Glass Physics Hierarchy
```
glass-panel           # Base panel with backdrop blur
glass-interactive     # Interactive elements (hover/active)
glass-modal           # Not used in this component
```

### Color System
```
Blue Accent (#3B82F6)    # Active states, buttons
Gray Neutral (#6B7280)   # Inactive states
White Background         # Panel background (90% opacity)
```

### Animation Timing
```
300ms  # Panel slide in/out
200ms  # Button/checkbox interactions
150ms  # Hover effects
```

### Responsive Breakpoints
```
mobile:  < 768px   # Full-width drawer
desktop: ≥ 768px   # Fixed 320px panel
```

## Performance Optimizations

### React Hooks
```typescript
// Memoize callbacks
const handleToggle = useCallback(..., [deps]);

// Memoize computed values
const filteredSubcategories = useMemo(..., [deps]);

// Optimize child components
const Section = React.memo(SectionComponent);
```

### Conditional Rendering
```typescript
// Only render sections when layer is visible
{layers.subdivisions && <SubdivisionSection />}
{layers.cities && <CitiesSection />}
{layers.pois && <POIsSection />}
```

### Event Optimization
```typescript
// Debounce expensive operations
const debouncedSearch = useMemo(
  () => debounce(setPoiSearchQuery, 300),
  []
);

// Batch state updates
setExpandedSections(prev => {
  const next = new Set(prev);
  // ... batch operations
  return next;
});
```

## Accessibility Implementation

### Semantic HTML
```html
<button aria-label="..." aria-expanded="..." />
<div role="region" aria-label="..." />
<input type="range" aria-valuemin="..." aria-valuemax="..." />
```

### Keyboard Navigation
```
Tab           # Navigate between controls
Shift+Tab     # Navigate backward
Space/Enter   # Activate buttons/checkboxes
Arrow Keys    # Adjust sliders
Escape        # Close panel (future enhancement)
```

### Screen Reader Support
```
- All interactive elements have descriptive labels
- State changes announced (aria-pressed, aria-checked)
- Value updates communicated (aria-valuenow, aria-valuetext)
- Proper heading hierarchy (h2 for main title)
```

## Testing Strategy

### Unit Tests (Recommended)
```typescript
// Component rendering
test("renders with default props", () => {});

// User interactions
test("toggles layer visibility", () => {});
test("updates subdivision levels", () => {});
test("searches POI subcategories", () => {});

// State management
test("manages section expansion", () => {});
test("filters POIs by search query", () => {});

// Accessibility
test("has proper ARIA labels", () => {});
test("supports keyboard navigation", () => {});
```

### Integration Tests
```typescript
// Map integration
test("updates map when layers change", () => {});
test("filters map data correctly", () => {});
test("applies opacity to map layers", () => {});

// Persistence
test("saves settings to localStorage", () => {});
test("loads settings on mount", () => {});
```

## Future Architecture Enhancements

### Preset System
```typescript
interface LayerPreset {
  name: string;
  description: string;
  settings: LayerControlsState;
}

const PRESETS: LayerPreset[] = [
  {
    name: "Urban View",
    description: "Focus on cities and infrastructure",
    settings: { /* ... */ }
  },
  // ...
];
```

### Layer Groups
```typescript
interface LayerGroup {
  name: string;
  layers: string[];
  collapsed: boolean;
}

// Group related layers
const GROUPS: LayerGroup[] = [
  {
    name: "Geographic",
    layers: ["boundaries", "subdivisions"],
    collapsed: false
  },
  {
    name: "Points",
    layers: ["cities", "pois"],
    collapsed: false
  }
];
```

### Advanced POI Filtering
```typescript
interface POIFilter {
  categories: string[];
  subcategories: string[];
  attributes: {
    hasImage: boolean;
    hasDescription: boolean;
    importance: number[];
  };
}
```

## File Size Analysis

```
LayerControls.tsx              # 820 lines (~28 KB)
├── Imports & Types            #  50 lines
├── Constants                  #  30 lines
├── Main Component             # 400 lines
│   ├── State Management       #  20 lines
│   ├── Event Handlers         # 120 lines
│   ├── Quick Actions          #  60 lines
│   └── Render                 # 200 lines
├── Sub-Components             # 250 lines
│   ├── Section                #  30 lines
│   ├── LayerToggle            #  40 lines
│   ├── Checkbox               #  60 lines
│   └── OpacitySlider          # 120 lines
└── Styles Injection           #  90 lines
```

## Dependencies

### Required
- `react` - Core React library
- `lucide-react` - Icon components
- `~/lib/poi-taxonomy` - POI taxonomy data

### Implied (from project)
- Tailwind CSS v4 - Styling utilities
- Next.js 15 - Client component support

## Browser Compatibility

```
Feature                 Chrome  Firefox  Safari  Edge
─────────────────────────────────────────────────────
Backdrop Filter         76+     103+     14+     79+
CSS Grid                57+     52+      10+     16+
Custom Properties       49+     31+      10+     15+
Range Input             4+      3.5+     3.1+    12+
```

## Conclusion

The LayerControls component is a production-ready, feature-complete solution for map layer management. Its modular architecture, comprehensive accessibility support, and integration with the IxStats design system make it an excellent addition to the map editor toolkit.

**Key Strengths:**
- Comprehensive feature set
- Clean, maintainable code structure
- Full accessibility support
- Responsive design
- Performance optimized
- Well documented

**Integration Ready:**
- Props interface clearly defined
- Example implementation provided
- POI taxonomy integrated
- No external dependencies beyond project standards
