# IxStats Styles Organization

## File Structure Overview

This directory contains modular CSS files for the IxStats application. Each file serves a specific purpose to maintain clean separation of concerns and avoid duplication.

### Core Files

- **`globals.css`** - Main entry point that imports all other CSS files
- **`shared-utilities.css`** - Common utilities used across multiple components (tier badges, status indicators, shared animations, loading states)

### Theme & Design System

- **`themes.css`** - CSS custom properties for color system, fonts, and design tokens
- **`aurora-backgrounds.css`** - Aurora effects and background animations for the main layout
- **`light-mode-overrides.css`** - Light mode theme overrides and accessibility features

### Layout & Behavior

- **`animations.css`** - Marquee animations, keyframe definitions, and performance optimizations
- **`performance.css`** - GPU acceleration, will-change properties, and scrollbar styles
- **`compact-mode.css`** - Compact UI mode with reduced spacing and font sizes

### Components

- **`components.css`** - Button, card, form, navigation, table, modal, and statistical display components
- **`charts.css`** - Chart-specific styling for data visualizations
- **`typography.css`** - Prose styles for wiki content, text utilities

### Specialized Features

- **`country-theming.css`** - Dynamic country flag-based theming system
- **`sdi-specialized.css`** - Strategic Defense Initiative specific styles and typography

## Import Order

The CSS files are imported in this specific order in `globals.css`:

1. `tailwindcss` - Base Tailwind CSS
2. `tw-animate-css` - Tailwind animation utilities
3. `shared-utilities.css` - Common utilities (imported first to allow overrides)
4. `animations.css` - Animation definitions
5. `performance.css` - Performance optimizations
6. `compact-mode.css` - Compact UI mode
7. `themes.css` - Design system tokens
8. `aurora-backgrounds.css` - Background effects
9. `typography.css` - Text styling
10. `components.css` - Component styles
11. `charts.css` - Chart styling
12. `light-mode-overrides.css` - Light mode theming
13. `country-theming.css` - Country-specific theming
14. `sdi-specialized.css` - SDI feature styles

## Deduplication Summary

The following duplicates were identified and consolidated:

### Moved to `shared-utilities.css`:
- **Tier badges** (`.tier-advanced`, `.tier-developed`, etc.) - Removed from `components.css` and `charts.css`
- **Status indicators** (`.status-online`, `.status-offline`, etc.) - Removed from `components.css` and `charts.css`
- **Loading states** (`.loading-spinner`, `.loading-skeleton`) - Removed from `components.css`
- **Common animations** (`@keyframes loading`, `@keyframes spin`, `@keyframes fadeIn`, etc.) - Removed from `components.css` and `charts.css`
- **Animation utilities** (`.animate-fade-in`, `.animate-slide-up`, etc.) - Removed from `charts.css`
- **Accessibility features** - Consolidated reduced motion and high contrast support

### Removed empty directories:
- `/animations/`
- `/components/`
- `/layout/`
- `/utilities/`

## Best Practices

1. **Add new shared utilities** to `shared-utilities.css` if they're used in multiple files
2. **Component-specific styles** should go in `components.css` or create a new file if it's a large feature
3. **Theme-related changes** should be made in `themes.css` or `light-mode-overrides.css`
4. **Performance optimizations** should be added to `performance.css`
5. **Always check for duplicates** before adding new styles - use grep to search across files

## File Size Optimization

After deduplication:
- Removed approximately 150+ lines of duplicate CSS
- Consolidated 20+ duplicate style definitions
- Improved maintainability by centralizing common utilities