# IxStats Design System v1.1.0

Comprehensive design system specification for the IxStats economic simulation platform. This document defines the Glass Physics framework, color theming, typography, component architecture, and implementation standards.

## Table of Contents

1. [Overview](#overview)
2. [Glass Physics Framework](#glass-physics-framework)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Component Architecture](#component-architecture)
6. [Animation Standards](#animation-standards)
7. [Responsive Design](#responsive-design)
8. [Accessibility](#accessibility)
9. [Component Standards](#component-standards)
10. [Layout Patterns](#layout-patterns)
11. [Code Examples](#code-examples)
12. [Migration Guide](#migration-guide)

---

## Overview

### Design Philosophy

IxStats employs a **Glass Physics** design system that creates visual depth through layered glassmorphic effects. The design philosophy emphasizes:

- **Visual Hierarchy**: Four distinct depth levels (parent, child, interactive, modal)
- **Contextual Theming**: Section-specific color schemes for intuitive navigation
- **Physics-Based Interaction**: Realistic glass refraction and depth perception
- **Performance**: GPU-accelerated effects with accessibility fallbacks
- **Consistency**: Unified component library with predictable behavior

### Design Goals

- Create an immersive, premium user experience
- Maintain WCAG 2.1 AA accessibility compliance
- Ensure performance across devices (60fps minimum)
- Provide intuitive visual feedback for all interactions
- Support both light and dark modes seamlessly

---

## Glass Physics Framework

The Glass Physics system creates realistic depth perception through layered glassmorphic effects with backdrop blur, saturation, and refraction.

### Depth Levels

#### 1. Parent Container (`.glass-hierarchy-parent`)

**Use Case**: Top-level sections, main page containers

**Properties**:
- Backdrop blur: `8px` (subtle)
- Background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)`
- Border: `1px solid rgba(255,255,255,0.1)`
- Saturation: `120%`
- Z-index: `1`

**Example**:
```tsx
<div className="glass-hierarchy-parent p-6 rounded-lg">
  <h1>Economic Dashboard</h1>
  {/* Child components */}
</div>
```

#### 2. Child Element (`.glass-hierarchy-child`)

**Use Case**: Cards, panels within sections, content groups

**Properties**:
- Backdrop blur: `16px` (moderate)
- Background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`
- Border: `1px solid rgba(255,255,255,0.1)`
- Saturation: `150%`
- Z-index: `2`

**Example**:
```tsx
<Card className="glass-hierarchy-child">
  <CardHeader>GDP Indicators</CardHeader>
  <CardContent>{/* Metrics */}</CardContent>
</Card>
```

#### 3. Interactive Element (`.glass-hierarchy-interactive`)

**Use Case**: Buttons, interactive cards, clickable items

**Properties**:
- Backdrop blur: `24px` (prominent)
- Background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)`
- Border: `1px solid rgba(255,255,255,0.15)`
- Saturation: `180%`
- Z-index: `3`
- Cursor: `pointer`
- Transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`

**Hover State**:
- Backdrop blur: `32px` (intense)
- Transform: `translateY(-1px)`
- Saturation: `200%`
- Shadow: `0 4px 16px rgba(0,0,0,0.1)`

**Example**:
```tsx
<button className="glass-hierarchy-interactive px-4 py-2 rounded-lg">
  View Details
</button>
```

#### 4. Modal/Popover (`.glass-modal`, `.glass-popover`)

**Use Case**: Modals, dropdowns, tooltips, command palette

**Properties**:
- Backdrop blur: `32px` (intense)
- Background: `linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 100%)`
- Border: `1px solid rgba(255,255,255,0.2)`
- Saturation: `220%`
- Z-index: `9999` (always on top)
- Shadow: Multi-layered for depth

**Example**:
```tsx
<DialogContent className="glass-modal">
  <DialogHeader>Confirm Action</DialogHeader>
  {/* Content */}
</DialogContent>
```

### Glass Depth Utilities

For more granular control, use `.glass-depth-1` through `.glass-depth-4`:

```tsx
// Subtle depth
<div className="glass-depth-1">Content</div>

// Medium depth
<div className="glass-depth-2">Content</div>

// Prominent depth
<div className="glass-depth-3">Content</div>

// Maximum depth (modals)
<div className="glass-depth-4">Content</div>
```

### Refraction Effects

Add realistic glass refraction edges with `.glass-refraction`:

```tsx
<Card className="glass-hierarchy-child glass-refraction">
  {/* Enhanced glass effect with edge lighting */}
</Card>
```

---

## Color System

### Section-Specific Themes

IxStats uses contextual color theming to help users navigate different sections intuitively:

| Section | Theme Color | Hex Code | Use Case |
|---------|------------|----------|----------|
| MyCountry | Gold | `#ca8a04` | Personal country management |
| Global Stats | Blue | `#2563eb` | Worldwide statistics |
| ECI (Economic) | Indigo | `#4f46e5` | Economic intelligence |
| SDI (Security) | Red | `#dc2626` | Security & defense |
| Demographics | Red | `#ef4444` | Population data |
| Fiscal | Gold | `#f59e0b` | Taxation & revenue |
| Government | Purple | `#8b5cf6` | Government systems |
| Labor | Emerald | `#10b981` | Employment metrics |

### Color Palette

#### Primary Colors

```css
--color-brand-primary: #6366f1;     /* indigo-500 */
--color-brand-secondary: #818cf8;   /* indigo-400 */
--color-brand-dark: #4f46e5;        /* indigo-600 */
```

#### Semantic Colors

```css
/* Success */
--color-success: #10b981;           /* green-500 */
--color-success-light: #34d399;
--color-success-dark: #059669;

/* Warning */
--color-warning: #f59e0b;           /* yellow-500 */
--color-warning-light: #fbbf24;
--color-warning-dark: #d97706;

/* Error */
--color-error: #ef4444;             /* red-500 */
--color-error-light: #f87171;
--color-error-dark: #dc2626;

/* Info */
--color-info: #3b82f6;              /* blue-500 */
--color-info-light: #60a5fa;
--color-info-dark: #2563eb;
```

#### Chart Colors

```css
--color-chart-1: #8b5cf6;           /* purple-500 */
--color-chart-2: #06b6d4;           /* cyan-500 */
--color-chart-3: #84cc16;           /* lime-500 */
--color-chart-4: #f97316;           /* orange-500 */
--color-chart-5: #ec4899;           /* pink-500 */
--color-chart-6: #14b8a6;           /* teal-500 */
```

### Theme Variables (CSS Custom Properties)

All colors support dynamic theming via CSS custom properties:

```css
/* Section-specific theme application */
.section-economic {
  --primitive-primary: hsl(var(--color-success-hsl));
  --primitive-accent: hsl(160, 84%, 39%);
  --primitive-background: hsl(var(--color-success-hsl) / 0.05);
  --primitive-border: hsl(var(--color-success-hsl) / 0.3);
}
```

### Dark Mode Support

All colors automatically adapt to dark mode using the `.dark` class:

```css
/* Light mode (default) */
:root {
  --color-bg-primary: #f9fafb;      /* gray-50 */
  --color-text-primary: #495057;
}

/* Dark mode */
.dark {
  --color-bg-primary: #111827;      /* gray-900 */
  --color-text-primary: #f9fafb;    /* gray-50 */
}
```

---

## Typography

### Font Stack

```css
--font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
```

### Size Scale

| Name | Size | Line Height | Use Case |
|------|------|-------------|----------|
| xs | 0.75rem (12px) | 1rem | Captions, labels |
| sm | 0.875rem (14px) | 1.25rem | Body text, descriptions |
| base | 1rem (16px) | 1.5rem | Default body text |
| lg | 1.125rem (18px) | 1.75rem | Large body text |
| xl | 1.25rem (20px) | 1.75rem | Section headings |
| 2xl | 1.5rem (24px) | 2rem | Card titles |
| 3xl | 1.875rem (30px) | 2.25rem | Page headings |
| 4xl | 2.25rem (36px) | 2.5rem | Hero text |

### Weight System

```css
font-weight: 300; /* light - Rarely used */
font-weight: 400; /* normal - Body text */
font-weight: 500; /* medium - Emphasis, labels */
font-weight: 600; /* semibold - Headings, buttons */
font-weight: 700; /* bold - Strong emphasis */
```

### Usage Examples

```tsx
// Page title
<h1 className="text-3xl font-bold">Economic Dashboard</h1>

// Section heading
<h2 className="text-2xl font-semibold">GDP Indicators</h2>

// Card title
<h3 className="text-xl font-medium">Gross Domestic Product</h3>

// Body text
<p className="text-base font-normal">Economic analysis content...</p>

// Caption
<span className="text-xs text-muted-foreground">Last updated 2 hours ago</span>
```

---

## Component Architecture

### Component Hierarchy

```
Atomic Design Pattern
├── Atoms (Primitives)
│   ├── Builder primitives (/src/app/builder/primitives/enhanced/)
│   └── Base UI components (/src/components/ui/)
├── Molecules (Shared Components)
│   ├── MetricCard, DataTable, ValidatedInput
│   └── /src/components/shared/
├── Organisms (Feature Components)
│   ├── Dashboard sections, Builder pages
│   └── /src/app/[feature]/_components/
└── Templates (Page Layouts)
    └── Full page compositions
```

### When to Use Shared Components vs Builder Primitives

#### Use Shared Components (`/src/components/shared/`) When:

✅ Building standard UI patterns (cards, tables, forms)
✅ Need built-in validation and error states
✅ Require consistent behavior across features
✅ Want automatic theming support
✅ Building new features from scratch

**Example**:
```tsx
import { MetricCard, DataTable, ValidatedInput } from '~/components/shared';

<MetricCard
  title="GDP"
  value="$2.5T"
  trend={{ direction: 'up', value: 3.2 }}
  theme={economicTheme}
/>
```

#### Use Builder Primitives (`/src/app/builder/primitives/enhanced/`) When:

✅ Building specialized economic/government interfaces
✅ Need NumberFlow animations for economic data
✅ Require enhanced chart integrations
✅ Working within builder-specific contexts

**Example**:
```tsx
import { EnhancedNumberInput, EnhancedBarChart } from '~/app/builder/primitives/enhanced';

<EnhancedNumberInput
  value={gdpValue}
  onChange={setGdpValue}
  sectionId="core"
  animationDuration={400}
/>
```

### Component Selection Decision Tree

```
Need a component?
├── Is it a standard UI pattern? (card, table, form)
│   └── YES → Use Shared Components (/src/components/shared/)
├── Is it builder-specific with economic calculations?
│   └── YES → Use Builder Primitives (/src/app/builder/primitives/)
├── Is it feature-specific with unique behavior?
│   └── YES → Create in feature directory (/src/app/[feature]/_components/)
└── Is it a base UI element? (button, input, dialog)
    └── YES → Use Base UI (/src/components/ui/)
```

### Glass Physics Integration Pattern

All components should support glass physics through className composition:

```tsx
// Base component with glass physics
<Card className="glass-hierarchy-child">
  {/* Content */}
</Card>

// Interactive component
<button className="glass-hierarchy-interactive">
  Click Me
</button>

// Themed glass component
<div className="glass-mycountry glass-interactive">
  {/* MyCountry section content */}
</div>
```

---

## Animation Standards

### Framer Motion Usage Guidelines

IxStats uses Framer Motion for all animations. Follow these patterns:

#### Animation Durations

| Type | Duration | Use Case |
|------|----------|----------|
| Instant | 100ms | Micro-interactions, hover states |
| Fast | 200ms | Button presses, scale effects |
| Normal | 300ms | Fade in/out, slide transitions |
| Slow | 400ms | Number flow, complex animations |
| Very Slow | 500ms+ | Page transitions, large movements |

#### Easing Functions

```typescript
const EASING_FUNCTIONS = {
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],      // Most common, fast start
  easeInOut: [0.4, 0, 0.2, 1],  // Balanced, default choice
};
```

#### Animation Presets

```typescript
const MOTION_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideInFromLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  }
};
```

#### NumberFlow Animation

For animated numbers (economic data, statistics):

```tsx
import { useAnimatedValue } from '~/app/builder/primitives/enhanced/animation-utils';

const animatedGDP = useAnimatedValue(gdpValue, {
  duration: 400,
  easing: 'easeOut'
});

<motion.span>{animatedGDP}</motion.span>
```

### Performance Considerations

- Use `will-change` sparingly (only for actively animating elements)
- Prefer `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (CPU-bound)
- Use `React.memo` for components with frequent prop changes
- Implement animation cancellation for unmounted components

```tsx
// Good - GPU accelerated
<motion.div
  animate={{ x: 100, opacity: 1 }}
  transition={{ duration: 0.3 }}
/>

// Bad - CPU bound
<motion.div
  animate={{ width: 200 }}
  transition={{ duration: 0.3 }}
/>
```

---

## Responsive Design

### Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Small devices (phones landscape) */
md: 768px   /* Medium devices (tablets) */
lg: 1024px  /* Large devices (laptops) */
xl: 1280px  /* Extra large devices (desktops) */
2xl: 1536px /* 2X large devices (large desktops) */
```

### Mobile-First Patterns

Always design mobile-first, then enhance for larger screens:

```tsx
<div className="
  grid grid-cols-1           /* Mobile: single column */
  md:grid-cols-2             /* Tablet: 2 columns */
  lg:grid-cols-3             /* Desktop: 3 columns */
  gap-4                      /* Consistent spacing */
">
  <MetricCard {...props} />
</div>
```

### Responsive Typography

```tsx
<h1 className="
  text-2xl                   /* Mobile: 24px */
  md:text-3xl                /* Tablet: 30px */
  lg:text-4xl                /* Desktop: 36px */
  font-bold
">
  Dashboard
</h1>
```

### Desktop Enhancements

- Show additional details on hover (desktop only)
- Enable keyboard shortcuts
- Display tooltips and popovers
- Multi-column layouts

```tsx
<div className="
  hidden md:block             /* Hide on mobile */
">
  <DetailedAnalysis />
</div>
```

### Glass Effects on Mobile

Reduce blur intensity on mobile for performance:

```css
@media (max-width: 768px) {
  .glass-base {
    backdrop-filter: blur(8px) saturate(150%);
  }

  .glass-floating {
    backdrop-filter: blur(16px) saturate(160%);
  }
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

All components must meet WCAG 2.1 Level AA standards:

#### Color Contrast

- Normal text: Minimum 4.5:1 contrast ratio
- Large text (18px+): Minimum 3:1 contrast ratio
- UI components: Minimum 3:1 contrast ratio

```tsx
// Good - High contrast
<span className="text-foreground">High contrast text</span>

// Bad - Low contrast
<span className="text-gray-400">Low contrast text</span>
```

#### Focus Indicators

All interactive elements must have visible focus indicators:

```css
/* Default focus ring */
.focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Custom focus for glass components */
.glass-hierarchy-interactive:focus-visible {
  outline: 2px solid rgba(99, 102, 241, 0.8);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
}
```

### ARIA Patterns

#### Buttons

```tsx
<button
  aria-label="Close dialog"
  aria-pressed={isActive}
>
  <X className="h-4 w-4" />
</button>
```

#### Regions

```tsx
<section
  aria-labelledby="economic-heading"
  role="region"
>
  <h2 id="economic-heading">Economic Indicators</h2>
  {/* Content */}
</section>
```

#### Live Regions

```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  GDP updated: $2.5T
</div>
```

### Keyboard Navigation

All interactive elements must be keyboard accessible:

- `Tab`: Move focus forward
- `Shift + Tab`: Move focus backward
- `Enter`/`Space`: Activate button/link
- `Escape`: Close modal/popover
- `Arrow keys`: Navigate within components

```tsx
// Keyboard-accessible dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={handleAction}>
      Action
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Standards

### Naming Conventions

#### Components

```typescript
// PascalCase for React components
export function MetricCard() { }
export function EconomicDashboard() { }

// Descriptive, specific names
✅ UserProfileCard
❌ Card1
```

#### Files

```bash
# Component files: PascalCase.tsx
MetricCard.tsx
EconomicDashboard.tsx

# Utility files: kebab-case.ts
animation-utils.ts
theme-utils.ts

# Type files: kebab-case.ts
economy-builder.ts
validation.ts
```

### Props Patterns

#### Interface Definition

```typescript
export interface MetricCardProps {
  // Required props first
  title: string;
  value: string | number;

  // Optional props
  description?: string;
  icon?: LucideIcon;

  // Event handlers
  onClick?: () => void;
  onChange?: (value: number) => void;

  // State props
  loading?: boolean;
  disabled?: boolean;

  // Styling
  className?: string;
  theme?: ComponentTheme;
}
```

#### Default Props

```typescript
export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  status = 'neutral',  // Default value
  loading = false,     // Default value
  className
}: MetricCardProps) {
  // Component implementation
}
```

### State Management

#### Local State (useState)

```typescript
const [isOpen, setIsOpen] = useState(false);
const [gdpValue, setGdpValue] = useState(0);
```

#### Computed State (useMemo)

```typescript
const sortedCountries = useMemo(() => {
  return countries.sort((a, b) => b.gdp - a.gdp);
}, [countries]);
```

#### Effect State (useEffect)

```typescript
useEffect(() => {
  const fetchData = async () => {
    const data = await api.countries.getAll();
    setCountries(data);
  };
  fetchData();
}, []);
```

### Error Handling

#### Error Boundaries

```tsx
<ErrorBoundary fallback={<ErrorDisplay />}>
  <DashboardContent />
</ErrorBoundary>
```

#### Try-Catch Patterns

```typescript
const handleSubmit = async () => {
  try {
    await api.countries.update(data);
    toast.success('Updated successfully');
  } catch (error) {
    console.error('Update failed:', error);
    toast.error('Failed to update');
  }
};
```

---

## Layout Patterns

### Section Wrappers

Use `SectionWrapper` for consistent section layouts:

```tsx
import { SectionWrapper } from '~/components/shared';

<SectionWrapper
  title="Economic Indicators"
  description="Key metrics for economic analysis"
  icon={TrendingUp}
  collapsible
  defaultExpanded
>
  <div className="grid grid-cols-3 gap-4">
    {/* Content */}
  </div>
</SectionWrapper>
```

### Grid Systems

#### Responsive Grid

```tsx
<div className="
  container mx-auto
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
  gap-4 md:gap-6
  p-4 md:p-6
">
  {items.map(item => <GridItem key={item.id} {...item} />)}
</div>
```

#### Auto-fit Grid

```tsx
<div className="
  grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]
  gap-4
">
  {/* Cards automatically adjust */}
</div>
```

### Spacing Scale

Use consistent spacing throughout:

```css
/* Tailwind spacing scale */
gap-1: 0.25rem (4px)
gap-2: 0.5rem (8px)
gap-3: 0.75rem (12px)
gap-4: 1rem (16px)      /* Most common */
gap-6: 1.5rem (24px)    /* Section spacing */
gap-8: 2rem (32px)      /* Large sections */
```

### Container Constraints

```css
/* Global container max-width */
.container {
  max-width: 1536px; /* screen-2xl */
}
```

---

## Code Examples

### Complete Component Example

```tsx
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';

interface EconomicCardProps {
  title: string;
  value: number;
  trend: number;
  className?: string;
}

export function EconomicCard({
  title,
  value,
  trend,
  className
}: EconomicCardProps) {
  const trendColor = trend >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card className={cn(
        'glass-hierarchy-child glass-refraction',
        'hover:glass-depth-2 transition-all duration-200',
        className
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            {title}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(value / 1e9).toFixed(1)}B
          </div>
          <p className={cn('text-xs font-medium', trendColor)}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs last quarter
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

### Themed Component Example

```tsx
import { useSectionTheme } from '~/app/builder/primitives/enhanced/theme-utils';

export function ThemedSection({ sectionId }: { sectionId: SectionId }) {
  const { colors, cssVars } = useSectionTheme(sectionId);

  return (
    <div
      className="glass-hierarchy-child p-6 rounded-lg"
      style={cssVars as React.CSSProperties}
    >
      <h2 style={{ color: colors.accent }}>
        {sectionId} Section
      </h2>
      {/* Content automatically themed */}
    </div>
  );
}
```

### Form with Validation Example

```tsx
import { ValidatedInput, ValidationRules } from '~/components/shared';

export function EconomicForm() {
  const [gdp, setGdp] = useState<number>(0);

  return (
    <form className="space-y-4">
      <ValidatedInput
        label="GDP (USD)"
        value={gdp.toString()}
        onChange={(value, isValid) => {
          if (isValid) setGdp(parseFloat(value));
        }}
        rules={[
          ValidationRules.required(),
          ValidationRules.number(),
          ValidationRules.min(1000),
          ValidationRules.positive()
        ]}
        helperText="Enter GDP in US Dollars"
        successMessage="Valid GDP value"
      />
    </form>
  );
}
```

---

## Migration Guide

### Moving from Custom to Shared Components

#### Before (Custom Implementation)

```tsx
// 15+ lines of repetitive code
<Card className="glass-hierarchy-child border-green-500/20">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium">GDP</CardTitle>
      <TrendingUp className="h-4 w-4 text-green-500" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">$2.5T</div>
    {trend && (
      <div className="flex items-center gap-1 text-xs">
        <span className={trend > 0 ? 'text-green-500' : 'text-red-500'}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
        <span className="text-muted-foreground">vs last quarter</span>
      </div>
    )}
  </CardContent>
</Card>
```

#### After (Shared Component)

```tsx
// 5 lines, same functionality + more features
<MetricCard
  title="GDP"
  value="$2.5T"
  icon={TrendingUp}
  trend={{ direction: 'up', value: 3.2, label: 'vs last quarter' }}
  status="success"
/>
```

### Benefits of Migration

- **90% less code**: Average reduction from 15 lines to 3-5 lines
- **Built-in features**: Loading states, error handling, validation included
- **Automatic theming**: Section-aware color schemes
- **Type safety**: Full TypeScript support with IntelliSense
- **Consistency**: Guaranteed uniform behavior across features
- **Maintenance**: Single source of truth for bug fixes

### Current Adoption Status

**Component Library Stats** (October 2025):
- Shared components: 2% adoption (target: 60%)
- Builder primitives: 86% adoption (highly specialized)
- Custom implementations: 12% (candidates for migration)

### Recommended Migration Path

1. **Identify duplicated patterns** in your feature code
2. **Check shared library** for existing equivalent component
3. **Replace gradually** (one component type at a time)
4. **Test thoroughly** to ensure behavior matches
5. **Remove old code** once migration is verified

### Getting Help

For migration questions or component requests:
- Check `/src/components/shared/README.md` for usage examples
- Review `/docs/DOCUMENTATION_INDEX.md` for architecture overview
- Reference this design system for standards compliance

---

## Version History

- **v1.1.0** (Current) - Comprehensive design system documentation
- **v1.0.0** - Initial glass physics implementation
- **v0.9.0** - Color system and theming framework

---

## Additional Resources

- [Shared Component Library](/src/components/shared/README.md)
- [Builder Primitives](/src/app/builder/primitives/enhanced/)
- [Documentation Index](/docs/DOCUMENTATION_INDEX.md)
- [Implementation Status](/IMPLEMENTATION_STATUS.md)

---

**Design System Maintained by**: IxStats Development Team
**Last Updated**: October 2025
**Next Review**: Q1 2026
