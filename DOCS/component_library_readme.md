# Component Library & Design System Implementation Guide
*Building the foundational UI components for IxStats*

## 📋 Overview

The Component Library serves as the foundational design system for IxStats, providing reusable, accessible, and beautifully designed components that maintain consistency across the entire application while supporting the sophisticated glassmorphism aesthetic.

### Key Objectives
- **Consistency**: Unified design language across all interfaces
- **Accessibility**: WCAG 2.1 AA compliance for all components
- **Performance**: Optimized components with minimal bundle impact
- **Flexibility**: Highly customizable while maintaining design coherence
- **Developer Experience**: Excellent TypeScript support and documentation
- **Visual Excellence**: Premium glassmorphism effects and animations

---

## 🏗️ Component Architecture

### Design System Hierarchy
```
Components/
├── Primitives/               # Base building blocks
│   ├── Box.tsx              # Layout primitive
│   ├── Text.tsx             # Typography primitive
│   ├── Stack.tsx            # Spacing primitive
│   └── Grid.tsx             # Grid primitive
├── Core/                    # Essential UI components
│   ├── Button/              # Button variations
│   ├── Input/               # Form inputs
│   ├── Card/                # Content containers
│   ├── Modal/               # Overlays and dialogs
│   └── Navigation/          # Navigation elements
├── Enhanced/                # Glassmorphism-enhanced components
│   ├── GlassCard/           # Premium card component
│   ├── GlassButton/         # Premium button component
│   ├── GlassPanel/          # Premium panel component
│   └── GlassModal/          # Premium modal component
├── Composite/               # Complex composite components
│   ├── DataTable/           # Advanced table component
│   ├── Charts/              # Data visualization
│   ├── Forms/               # Form compositions
│   └── Navigation/          # Navigation compositions
├── Domain/                  # IxStats-specific components
│   ├── Nation/              # Nation-related components
│   ├── Economics/           # Economic data components
│   ├── Analytics/           # Analytics components
│   └── IxTime/              # Time system components
└── Utils/                   # Utility components
    ├── ErrorBoundary/       # Error handling
    ├── LoadingStates/       # Loading indicators
    ├── Animations/          # Animation utilities
    └── Providers/           # Context providers
```

### Technology Foundation
```typescript
{
  baseLibrary: "shadcn/ui",           // Accessible primitives
  styling: "Tailwind CSS + CSS-in-JS", // Flexible styling
  animations: "Framer Motion",        // Advanced animations
  icons: "Lucide React",             // Consistent iconography
  themes: "CSS Custom Properties",    // Dynamic theming
  testing: "Testing Library + Storybook", // Component testing
  documentation: "Storybook + MDX"   // Living documentation
}
```

---

## 🎨 Design Token System

### Enhanced CSS Custom Properties
```css
/* components/styles/design-tokens.css */
:root {
  /* === ENHANCED COLOR SYSTEM === */
  
  /* Base Colors (Dark Theme Default) */
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  --color-muted: #262626;
  --color-muted-foreground: #a3a3a3;
  --color-border: #404040;
  --color-input: #262626;
  --color-ring: #3b82f6;

  /* Brand Colors */
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;
  --color-secondary: #262626;
  --color-secondary-foreground: #fafafa;
  --color-accent: #1e40af;
  --color-accent-foreground: #ffffff;

  /* Semantic Colors */
  --color-destructive: #dc2626;
  --color-destructive-foreground: #ffffff;
  --color-success: #16a34a;
  --color-success-foreground: #ffffff;
  --color-warning: #ca8a04;
  --color-warning-foreground: #ffffff;
  --color-info: #0ea5e9;
  --color-info-foreground: #ffffff;

  /* === GLASSMORPHISM SYSTEM === */
  
  /* Glass Background Colors */
  --glass-background: rgba(0, 0, 0, 0.4);
  --glass-background-light: rgba(255, 255, 255, 0.1);
  --glass-background-strong: rgba(0, 0, 0, 0.6);
  
  /* Glass Border Colors */
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-border-strong: rgba(255, 255, 255, 0.2);
  --glass-border-accent: rgba(59, 130, 246, 0.3);
  
  /* Blur Effects */
  --glass-blur-subtle: blur(4px);
  --glass-blur-medium: blur(8px);
  --glass-blur-strong: blur(16px);
  --glass-blur-extreme: blur(24px);
  
  /* Glass Shadows */
  --glass-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --glass-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.15);
  --glass-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.2);
  --glass-shadow-xl: 0 16px 64px rgba(0, 0, 0, 0.25);

  /* === PREMIUM EFFECTS === */
  
  /* Glow Effects */
  --glow-primary: 0 0 20px rgba(59, 130, 246, 0.4);
  --glow-secondary: 0 0 20px rgba(168, 85, 247, 0.4);
  --glow-success: 0 0 20px rgba(22, 163, 74, 0.4);
  --glow-warning: 0 0 20px rgba(202, 138, 4, 0.4);
  --glow-danger: 0 0 20px rgba(220, 38, 38, 0.4);
  
  /* Gradient Backgrounds */
  --gradient-primary: linear-gradient(135deg, #3b82f6, #1e40af);
  --gradient-secondary: linear-gradient(135deg, #a855f7, #7c3aed);
  --gradient-success: linear-gradient(135deg, #16a34a, #15803d);
  --gradient-danger: linear-gradient(135deg, #dc2626, #b91c1c);
  
  /* === TYPOGRAPHY SYSTEM === */
  
  /* Font Families */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  
  /* Font Sizes */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  --text-5xl: 3rem;      /* 48px */
  --text-6xl: 3.75rem;   /* 60px */
  
  /* Font Weights */
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  
  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;

  /* === SPACING SYSTEM === */
  
  /* Spacing Scale */
  --space-0: 0;
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */
  --space-32: 8rem;      /* 128px */

  /* === ANIMATION SYSTEM === */
  
  /* Durations */
  --duration-75: 75ms;
  --duration-100: 100ms;
  --duration-150: 150ms;
  --duration-200: 200ms;
  --duration-300: 300ms;
  --duration-500: 500ms;
  --duration-700: 700ms;
  --duration-1000: 1000ms;
  
  /* Timing Functions */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* === BREAKPOINTS === */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  /* === Z-INDEX SCALE === */
  --z-behind: -1;
  --z-auto: auto;
  --z-base: 0;
  --z-docked: 10;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-banner: 1200;
  --z-overlay: 1300;
  --z-modal: 1400;
  --z-popover: 1500;
  --z-skiplink: 1600;
  --z-toast: 1700;
  --z-tooltip: 1800;
}

/* Light Theme Overrides */
.light {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-muted: #f5f5f5;
  --color-muted-foreground: #737373;
  --color-border: #e5e5e5;
  --color-input: #ffffff;
  
  /* Light Glass Effects */
  --glass-background: rgba(255, 255, 255, 0.7);
  --glass-background-light: rgba(255, 255, 255, 0.9);
  --glass-background-strong: rgba(255, 255, 255, 0.5);
  --glass-border: rgba(0, 0, 0, 0.1);
  --glass-border-strong: rgba(0, 0, 0, 0.15);
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-75: 0ms;
    --duration-100: 0ms;
    --duration-150: 0ms;
    --duration-200: 0ms;
    --duration-300: 0ms;
    --duration-500: 0ms;
    --duration-700: 0ms;
    --duration-1000: 0ms;
  }
}
```

---

## 🧩 Enhanced Component Implementation

### 1. GlassCard Component
```tsx
// components/enhanced/GlassCard/GlassCard.tsx
'use client';

import React from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Component variants using CVA
const glassCardVariants = cva(
  // Base styles
  [
    'relative overflow-hidden rounded-xl',
    'backdrop-blur-md border',
    'transition-all duration-300 ease-out',
    'before:absolute before:inset-0 before:rounded-xl',
    'before:bg-gradient-to-br before:opacity-20',
    'before:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-glass-background border-glass-border',
          'shadow-glass-md',
          'before:from-white before:to-transparent',
        ],
        primary: [
          'bg-glass-background border-glass-border-accent',
          'shadow-glass-md',
          'before:from-blue-500 before:to-purple-500',
        ],
        secondary: [
          'bg-glass-background-light border-glass-border',
          'shadow-glass-sm',
          'before:from-purple-500 before:to-pink-500',
        ],
        success: [
          'bg-glass-background border-green-500/20',
          'shadow-glass-md',
          'before:from-green-500 before:to-emerald-500',
        ],
        warning: [
          'bg-glass-background border-yellow-500/20',
          'shadow-glass-md',
          'before:from-yellow-500 before:to-orange-500',
        ],
        danger: [
          'bg-glass-background border-red-500/20',
          'shadow-glass-md',
          'before:from-red-500 before:to-pink-500',
        ],
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      blur: {
        none: 'backdrop-blur-none',
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg',
        xl: 'backdrop-blur-xl',
      },
      glow: {
        none: '',
        subtle: 'shadow-glow-primary/20',
        medium: 'shadow-glow-primary/40',
        strong: 'shadow-glow-primary/60',
      },
      hover: {
        none: '',
        lift: 'hover:translate-y-[-4px] hover:shadow-glass-lg',
        glow: 'hover:shadow-glow-primary',
        scale: 'hover:scale-[1.02]',
        rotate: 'hover:rotate-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      blur: 'md',
      glow: 'none',
      hover: 'none',
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants>,
    MotionProps {
  asChild?: boolean;
  interactive?: boolean;
  disabled?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      variant,
      size,
      blur,
      glow,
      hover,
      asChild = false,
      interactive = false,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? motion.div : motion.div;
    
    // Animation variants
    const animationVariants = {
      initial: { opacity: 0, y: 20, scale: 0.95 },
      animate: { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
          duration: 0.4,
          ease: 'easeOut',
        },
      },
      exit: { 
        opacity: 0, 
        y: -20, 
        scale: 0.95,
        transition: {
          duration: 0.2,
          ease: 'easeIn',
        },
      },
      hover: interactive && !disabled ? {
        scale: 1.02,
        transition: { duration: 0.2 },
      } : {},
      tap: interactive && !disabled ? {
        scale: 0.98,
        transition: { duration: 0.1 },
      } : {},
    };

    return (
      <Component
        ref={ref}
        className={cn(
          glassCardVariants({ variant, size, blur, glow, hover }),
          interactive && 'cursor-pointer',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        variants={animationVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        whileHover="hover"
        whileTap="tap"
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// Compound components for structured content
export const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-6', className)}
    {...props}
  />
));
GlassCardHeader.displayName = 'GlassCardHeader';

export const GlassCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
GlassCardTitle.displayName = 'GlassCardTitle';

export const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
GlassCardDescription.displayName = 'GlassCardDescription';

export const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('pt-0', className)} {...props} />
));
GlassCardContent.displayName = 'GlassCardContent';

export const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-6', className)}
    {...props}
  />
));
GlassCardFooter.displayName = 'GlassCardFooter';
```

### 2. GlassButton Component
```tsx
// components/enhanced/GlassButton/GlassButton.tsx
'use client';

import React from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const glassButtonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md text-sm font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    'relative overflow-hidden',
    'backdrop-blur-md border',
    'before:absolute before:inset-0 before:rounded-md',
    'before:bg-gradient-to-r before:opacity-0',
    'before:transition-opacity before:duration-200',
    'hover:before:opacity-100',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-glass-background border-glass-border',
          'text-foreground shadow-glass-sm',
          'hover:shadow-glass-md',
          'before:from-white/10 before:to-white/5',
        ],
        primary: [
          'bg-gradient-to-r from-blue-600 to-blue-700',
          'text-primary-foreground shadow-glass-md',
          'border-blue-500/30',
          'hover:from-blue-500 hover:to-blue-600',
          'hover:shadow-glow-primary',
          'before:from-white/20 before:to-white/10',
        ],
        secondary: [
          'bg-glass-background-light border-glass-border',
          'text-foreground shadow-glass-sm',
          'hover:shadow-glass-md',
          'before:from-purple-500/20 before:to-pink-500/20',
        ],
        success: [
          'bg-gradient-to-r from-green-600 to-green-700',
          'text-success-foreground shadow-glass-md',
          'border-green-500/30',
          'hover:from-green-500 hover:to-green-600',
          'hover:shadow-glow-success',
          'before:from-white/20 before:to-white/10',
        ],
        warning: [
          'bg-gradient-to-r from-yellow-600 to-yellow-700',
          'text-warning-foreground shadow-glass-md',
          'border-yellow-500/30',
          'hover:from-yellow-500 hover:to-yellow-600',
          'hover:shadow-glow-warning',
          'before:from-white/20 before:to-white/10',
        ],
        danger: [
          'bg-gradient-to-r from-red-600 to-red-700',
          'text-destructive-foreground shadow-glass-md',
          'border-red-500/30',
          'hover:from-red-500 hover:to-red-600',
          'hover:shadow-glow-danger',
          'before:from-white/20 before:to-white/10',
        ],
        outline: [
          'border-2 border-glass-border-strong bg-transparent',
          'text-foreground shadow-glass-sm',
          'hover:bg-glass-background-light',
          'before:from-primary/10 before:to-primary/5',
        ],
        ghost: [
          'border-transparent bg-transparent',
          'text-foreground shadow-none',
          'hover:bg-glass-background',
          'before:from-primary/10 before:to-primary/5',
        ],
        link: [
          'border-transparent bg-transparent underline-offset-4',
          'text-primary shadow-none',
          'hover:underline',
          'before:hidden',
        ],
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-base',
        xl: 'h-12 px-10 text-lg',
        icon: 'h-10 w-10',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      rounded: 'md',
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants>,
    MotionProps {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : motion.button;
    const isDisabled = disabled || loading;

    // Animation variants
    const animationVariants = {
      initial: { scale: 1 },
      hover: { scale: 1.02 },
      tap: { scale: 0.98 },
    };

    return (
      <Component
        className={cn(glassButtonVariants({ variant, size, rounded }), className)}
        ref={ref}
        disabled={isDisabled}
        variants={animationVariants}
        whileHover="hover"
        whileTap="tap"
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && leftIcon && (
          <span className="button-icon-left">{leftIcon}</span>
        )}
        
        <span className="relative z-10">
          {loading && loadingText ? loadingText : children}
        </span>
        
        {!loading && rightIcon && (
          <span className="button-icon-right">{rightIcon}</span>
        )}
      </Component>
    );
  }
);

GlassButton.displayName = 'GlassButton';

// Button group component for related actions
export const GlassButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: 'horizontal' | 'vertical';
    spacing?: 'none' | 'sm' | 'md' | 'lg';
  }
>(({ className, orientation = 'horizontal', spacing = 'sm', children, ...props }, ref) => {
  const spacingClasses = {
    none: '',
    sm: orientation === 'horizontal' ? 'space-x-2' : 'space-y-2',
    md: orientation === 'horizontal' ? 'space-x-4' : 'space-y-4',
    lg: orientation === 'horizontal' ? 'space-x-6' : 'space-y-6',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'flex',
        orientation === 'horizontal' ? 'flex-row items-center' : 'flex-col',
        spacingClasses[spacing],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

GlassButtonGroup.displayName = 'GlassButtonGroup';
```

### 3. Advanced Data Table Component
```tsx
// components/composite/DataTable/DataTable.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  flexRender,
} from '@tanstack/react-table';
import { GlassCard } from '@/components/enhanced/GlassCard';
import { GlassButton } from '@/components/enhanced/GlassButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: TData) => void;
  onSelectionChange?: (selectedRows: TData[]) => void;
  onExport?: (data: TData[]) => void;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search...",
  filterable = true,
  exportable = false,
  selectable = false,
  pagination = true,
  pageSize = 10,
  loading = false,
  error = null,
  onRowClick,
  onSelectionChange,
  onExport,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Enhanced columns with selection if needed
  const enhancedColumns = useMemo(() => {
    if (selectable) {
      return [
        {
          id: 'select',
          header: ({ table }) => (
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
              className="rounded border border-glass-border bg-glass-background"
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={(e) => row.toggleSelected(!!e.target.checked)}
              className="rounded border border-glass-border bg-glass-background"
            />
          ),
          enableSorting: false,
          enableHiding: false,
        },
        ...columns,
      ];
    }
    return columns;
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: enhancedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
  });

  // Handle selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  if (error) {
    return (
      <GlassCard variant="danger" className={className}>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-destructive font-medium">Error loading data</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Global Search */}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 w-64 glass-input"
              />
            </div>
          )}

          {/* Column Filters */}
          {filterable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassButton variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                  Columns
                </GlassButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-dropdown">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Export Button */}
          {exportable && (
            <GlassButton
              variant="outline"
              size="sm"
              onClick={() => onExport?.(data)}
            >
              <Download className="h-4 w-4" />
              Export
            </GlassButton>
          )}

          {/* Selection Info */}
          {selectable && Object.keys(rowSelection).length > 0 && (
            <div className="text-sm text-muted-foreground">
              {Object.keys(rowSelection).length} of {table.getFilteredRowModel().rows.length} row(s) selected
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <GlassCard variant="default" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-glass-border">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center space-x-2',
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {header.column.getCanSort() && (
                            <span className="ml-2">
                              {header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronsUpDown className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {loading ? (
                  <tr key="loading">
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="h-24 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="text-muted-foreground">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'border-b border-glass-border transition-colors',
                        'hover:bg-glass-background-light/50',
                        onRowClick && 'cursor-pointer',
                        row.getIsSelected() && 'bg-glass-background-light'
                      )}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-4 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  ))
                ) : (
                  <tr key="no-results">
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="h-24 text-center">
                      <div className="text-muted-foreground">No results found.</div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between space-x-2 border-t border-glass-border p-4">
            <div className="text-sm text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
              {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)} of{' '}
              {table.getFilteredRowModel().rows.length} entries
            </div>
            <div className="flex items-center space-x-2">
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </GlassButton>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </GlassButton>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
```

---

## 🎯 Domain-Specific Components

### 1. Nation Flag Component
```tsx
// components/domain/Nation/NationFlag.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const flagVariants = cva(
  [
    'relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200',
    'flex items-center justify-center text-gray-400',
    'border border-glass-border',
  ],
  {
    variants: {
      size: {
        xs: 'w-4 h-3',
        sm: 'w-6 h-4',
        md: 'w-8 h-6',
        lg: 'w-12 h-8',
        xl: 'w-16 h-12',
        '2xl': 'w-20 h-15',
        '3xl': 'w-24 h-18',
      },
      rounded: {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
      },
      shadow: {
        none: '',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
      },
      hover: {
        none: '',
        scale: 'hover:scale-105 transition-transform duration-200',
        glow: 'hover:shadow-glow-primary/50 transition-shadow duration-200',
      },
    },
    defaultVariants: {
      size: 'md',
      rounded: 'sm',
      shadow: 'sm',
      hover: 'none',
    },
  }
);

export interface NationFlagProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof flagVariants> {
  src?: string;
  alt: string;
  fallback?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  onError?: () => void;
  onLoad?: () => void;
}

export const NationFlag = React.forwardRef<HTMLDivElement, NationFlagProps>(
  (
    {
      className,
      src,
      alt,
      fallback,
      size,
      rounded,
      shadow,
      hover,
      loading = 'lazy',
      priority = false,
      onError,
      onLoad,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const handleImageError = () => {
      setImageError(true);
      setImageLoading(false);
      onError?.();
    };

    const handleImageLoad = () => {
      setImageLoading(false);
      onLoad?.();
    };

    const showPlaceholder = !src || imageError;

    return (
      <motion.div
        ref={ref}
        className={cn(flagVariants({ size, rounded, shadow, hover }), className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        {...props}
      >
        {!showPlaceholder ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}
            <img
              src={src}
              alt={alt}
              loading={loading}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-200',
                imageLoading ? 'opacity-0' : 'opacity-100'
              )}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </>
        ) : (
          <span className="text-xs font-medium">
            {fallback || alt.charAt(0).toUpperCase()}
          </span>
        )}
      </motion.div>
    );
  }
);

NationFlag.displayName = 'NationFlag';

// Flag with tooltip showing nation name
export const NationFlagWithTooltip = React.forwardRef<
  HTMLDivElement,
  NationFlagProps & {
    nationName: string;
    showTooltip?: boolean;
  }
>(({ nationName, showTooltip = true, ...props }, ref) => {
  if (!showTooltip) {
    return <NationFlag ref={ref} {...props} />;
  }

  return (
    <motion.div
      ref={ref}
      className="relative group"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      <NationFlag {...props} />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {nationName}
      </div>
    </motion.div>
  );
});

NationFlagWithTooltip.displayName = 'NationFlagWithTooltip';
```

### 2. Economic Tier Badge Component
```tsx
// components/domain/Economics/EconomicTierBadge.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const tierVariants = cva(
  [
    'inline-flex items-center gap-1.5 font-medium',
    'backdrop-blur-sm border',
    'transition-all duration-200',
  ],
  {
    variants: {
      tier: {
        Advanced: [
          'bg-gradient-to-r from-purple-500/20 to-indigo-500/20',
          'border-purple-400/30 text-purple-200',
          'shadow-glow-primary/20',
        ],
        Developed: [
          'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
          'border-blue-400/30 text-blue-200',
          'shadow-glow-primary/20',
        ],
        Emerging: [
          'bg-gradient-to-r from-green-500/20 to-emerald-500/20',
          'border-green-400/30 text-green-200',
          'shadow-glow-success/20',
        ],
        Developing: [
          'bg-gradient-to-r from-yellow-500/20 to-orange-500/20',
          'border-yellow-400/30 text-yellow-200',
          'shadow-glow-warning/20',
        ],
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-1.5',
      },
      variant: {
        default: '',
        outline: 'bg-transparent',
        solid: 'border-transparent',
      },
    },
    defaultVariants: {
      tier: 'Developing',
      size: 'md',
      variant: 'default',
    },
  }
);

type EconomicTier = 'Advanced' | 'Developed' | 'Emerging' | 'Developing';

export interface EconomicTierBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tierVariants> {
  tier: EconomicTier;
  showIcon?: boolean;
  animated?: boolean;
}

const tierIcons = {
  Advanced: '💎',
  Developed: '🏭',
  Emerging: '🌱',
  Developing: '🌾',
};

const tierDescriptions = {
  Advanced: 'Highly developed economy with advanced technology and high GDP per capita',
  Developed: 'Well-established economy with strong institutions and infrastructure',
  Emerging: 'Growing economy with increasing industrialization and development',
  Developing: 'Developing economy with potential for growth and improvement',
};

export const EconomicTierBadge = React.forwardRef<HTMLSpanElement, EconomicTierBadgeProps>(
  (
    {
      className,
      tier,
      size,
      variant,
      showIcon = true,
      animated = false,
      ...props
    },
    ref
  ) => {
    const Component = animated ? motion.span : 'span';
    const animationProps = animated
      ? {
          initial: { scale: 0.9, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          whileHover: { scale: 1.05 },
          transition: { duration: 0.2 },
        }
      : {};

    return (
      <Component
        ref={ref}
        className={cn(tierVariants({ tier, size, variant }), className)}
        title={tierDescriptions[tier]}
        {...animationProps}
        {...props}
      >
        {showIcon && <span className="tier-icon">{tierIcons[tier]}</span>}
        <span className="tier-label">{tier}</span>
      </Component>
    );
  }
);

EconomicTierBadge.displayName = 'EconomicTierBadge';

// Tier comparison component
export const TierComparison = ({
  currentTier,
  previousTier,
  className,
}: {
  currentTier: EconomicTier;
  previousTier?: EconomicTier;
  className?: string;
}) => {
  const tierOrder: EconomicTier[] = ['Developing', 'Emerging', 'Developed', 'Advanced'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const previousIndex = previousTier ? tierOrder.indexOf(previousTier) : -1;
  
  const isImprovement = previousIndex >= 0 && currentIndex > previousIndex;
  const isDecline = previousIndex >= 0 && currentIndex < previousIndex;
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <EconomicTierBadge tier={currentTier} animated />
      {previousTier && currentTier !== previousTier && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1"
        >
          <span className="text-muted-foreground text-sm">from</span>
          <EconomicTierBadge tier={previousTier} size="sm" variant="outline" />
          <span className={cn(
            'text-sm font-medium',
            isImprovement && 'text-green-500',
            isDecline && 'text-red-500'
          )}>
            {isImprovement ? '↗' : isDecline ? '↘' : '→'}
          </span>
        </motion.div>
      )}
    </div>
  );
};
```

---

## 📚 Component Documentation System

### 1. Storybook Integration
```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-designs',
    '@storybook/addon-docs',
    '@storybook/addon-controls',
    '@storybook/addon-viewport',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  staticDirs: ['../public'],
};

export default config;
```

### 2. Component Stories Examples
```typescript
// components/enhanced/GlassCard/GlassCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from './GlassCard';

const meta: Meta<typeof GlassCard> = {
  title: 'Enhanced/GlassCard',
  component: GlassCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A beautiful glassmorphism card component with various styling options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'success', 'warning', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    blur: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl'],
    },
    glow: {
      control: 'select',
      options: ['none', 'subtle', 'medium', 'strong'],
    },
    hover: {
      control: 'select',
      options: ['none', 'lift', 'glow', 'scale', 'rotate'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <GlassCardHeader>
          <GlassCardTitle>Card Title</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p>This is a basic glass card with default styling.</p>
        </GlassCardContent>
      </>
    ),
  },
};

export const Primary: Story = {
  args: {
    variant: 'primary',
    glow: 'medium',
    hover: 'lift',
    children: (
      <>
        <GlassCardHeader>
          <GlassCardTitle>Primary Card</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p>A primary card with glow and hover effects.</p>
        </GlassCardContent>
      </>
    ),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      {['default', 'primary', 'secondary', 'success', 'warning', 'danger'].map((variant) => (
        <GlassCard key={variant} variant={variant as any} hover="lift">
          <GlassCardHeader>
            <GlassCardTitle className="capitalize">{variant} Card</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <p>Example content for {variant} variant.</p>
          </GlassCardContent>
        </GlassCard>
      ))}
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    variant: 'primary',
    hover: 'lift',
    interactive: true,
    children: (
      <>
        <GlassCardHeader>
          <GlassCardTitle>Interactive Card</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p>Click me! This card has interactive animations.</p>
        </GlassCardContent>
      </>
    ),
  },
};
```

### 3. Component Testing Utilities
```typescript
// components/__tests__/test-utils.tsx
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

// Theme wrapper for testing
const ThemeWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  </ThemeProvider>
);

// Custom render function with providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: ThemeWrapper, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Component testing helpers
export const mockNationData = {
  id: '1',
  name: 'Test Nation',
  economicTier: 'Advanced' as const,
  flagUrl: '/test-flag.png',
  currentGDP: 1000000000000,
  currentPopulation: 50000000,
};

export const expectAccessibility = async (component: HTMLElement) => {
  const { axe } = await import('jest-axe');
  const results = await axe(component);
  expect(results).toHaveNoViolations();
};
```

This comprehensive Component Library & Design System guide provides the foundation for building beautiful, accessible, and consistent UI components that power the entire IxStats application with premium glassmorphism effects and excellent developer experience.

