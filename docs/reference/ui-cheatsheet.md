# Frontend & UI Component Cheatsheet

> **Quick Reference for IxStates UI Engineering**  
> **Stack**: Next.js 16 App Router · React 19 · Tailwind CSS v4 · TypeScript 7.0 · Radix UI · Iconoir · Cuelume Haptics  
> **Design Language**: **Facet** (Depth, Materials, Refraction, Apple Physics)

---

## ⚡ The 7 Golden Rules

1. **Zero Raw Hexes**: Never use `[#...]` or inline style hexes. Always use semantic Tailwind v4 tokens (`bg-card`, `text-foreground`, `border-border/40`, `text-muted-foreground`, `bg-popover`, `ring-ring`).
2. **Encapsulated Primitives**: Never import `@radix-ui/*` directly in domain features. Always import from [`src/components/ui/`](file:///home/jxsig/projects/ixstats/src/components/ui/).
3. **Icons Standard**: Use `iconoir-react` exclusively. `lucide-react` is blocked.
4. **Polymorphic Triggers (`asChild`)**: Always pass `asChild` to Radix triggers (`<DialogTrigger asChild>`, `<DropdownMenuTrigger asChild>`) when wrapping buttons or custom elements to avoid nested `<button>` errors.
5. **Tactile Physics**: Add mechanical compression on press (`active:scale-[0.98] transition-transform duration-140`). Keep motion under 250ms.
6. **Audio Haptics (Cuelume)**: Attach declarative attributes (`data-cuelume-press="press"`, `data-cuelume-hover="tick"`, `data-cuelume-toggle`) or call `soundEffects.bloom()`.
7. **Desktop Sticky Clearance**: Sidebars and sticky rails must strictly use `lg:sticky lg:top-20` (80px) to clear the floating navbar with a 16px buffer.

---

## 📚 Component Recipes & Copy-Paste Snippets

### 1. Standard Button & Variants
```tsx
import { Button } from "~/components/ui/button";
import { Plus, Trash } from "iconoir-react";

// Default Primary
<Button variant="default" size="default">
  <Plus className="size-4" />
  <span>Create Directive</span>
</Button>

// Destructive Action
<Button variant="destructive" size="sm">
  <Trash className="size-3.5" />
  <span>Revoke</span>
</Button>

// Outline / Secondary
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon"><Plus className="size-4" /></Button>
```

---

### 2. Tactile Facet Card with Z-Depth
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Spark } from "iconoir-react";

export function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <Card 
      className="p-5 transition-all duration-150 hover:border-border/80 cursor-pointer active:scale-[0.98]"
      data-cuelume-press="press"
      data-cuelume-hover="tick"
    >
      <CardHeader className="p-0 flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        <Spark className="size-4 text-amber-500" />
      </CardHeader>
      <CardContent className="p-0">
        <CardDescription className="text-xs text-muted-foreground">{desc}</CardDescription>
      </CardContent>
    </Card>
  );
}
```

---

### 3. Dialog / Modal (Confirmation Flow)
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export function ConfirmDirectiveModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default">Declare Directive</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Policy Directive</DialogTitle>
          <DialogDescription>
            Are you sure you want to allocate CivCap capacity to this measure?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="default">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 4. Slide-Over Drawer (`Sheet`)
```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Menu } from "iconoir-react";

export function MobileDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Quick Settings</SheetTitle>
          <SheetDescription>Configure simulation parameters.</SheetDescription>
        </SheetHeader>
        <div className="py-4 text-xs text-muted-foreground">
          Drawer contents here...
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### 5. Dropdown Menu
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { MoreHoriz, Edit, Trash } from "iconoir-react";

export function ActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHoriz className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className="gap-2 text-xs">
          <Edit className="size-3.5" />
          <span>Edit Policy</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-xs text-destructive focus:text-destructive">
          <Trash className="size-3.5" />
          <span>Archive</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### 6. Dynamic Island / Halo Notification
```tsx
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";

export function NotificationTrigger() {
  const notify = useNotify();

  const handleAction = () => {
    // Automatically plays soundEffects.success() and pushes to Halo pill
    notify.success({
      title: "Directives Updated",
      message: "Civil capacity rebalanced across 4 sectors.",
    });
  };

  return (
    <Button onClick={handleAction} variant="secondary" size="sm">
      Rebalance
    </Button>
  );
}
```

---

### 7. Form Inputs & Textareas
> **Important**: Never put heavy pseudo-element blur masks on text inputs as they cause keystroke lag.

```tsx
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export function FormSnippet() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="directive-title">Directive Name</Label>
        <Input id="directive-title" placeholder="e.g. Agrarian Modernization" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="directive-desc">Rationale</Label>
        <Textarea id="directive-desc" placeholder="Describe the goal and timeline..." rows={3} />
      </div>
    </div>
  );
}
```

---

### 8. Loading Skeletons & Fallbacks
```tsx
import { Skeleton } from "~/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="p-4 border border-border/40 rounded-xl bg-card/50 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20 rounded" />
      <Skeleton className="h-3 w-40 rounded" />
    </div>
  );
}
```

---

## 🎨 Domain Color Palette Guide

IxStates applies distinctive ambient color accents across its major platform pillars:

| Domain | Semantic Accent Variable | Tailwind Class | Usage Context |
|---|---|---|---|
| **MyCountry** | `--color-amber-500` | `text-amber-500` / `bg-amber-500/10` | Executive command suite, Directives |
| **Global / Maps** | `--color-blue-500` | `text-blue-500` / `bg-blue-500/10` | World map viewer, Factbook atlas |
| **ThinkPages** | `--color-emerald-500` | `text-emerald-500` / `bg-emerald-500/10` | Social feeds, ThinkTanks, messages |
| **IxVault** | `--color-amber-600` | `text-amber-600` / `bg-amber-600/10` | Collectible cards, packs, credits |
| **Forum** | `--color-orange-500` | `text-orange-500` / `bg-orange-500/10` | Town hall discourse, bulletins |
| **Defense / Security** | `--color-rose-500` | `text-rose-500` / `bg-rose-500/10` | Threat alerts, readiness monitors |

---

## 🚫 Common Pitfalls & How to Avoid Them

```
❌ WRONG: Hardcoded arbitrary hexes
<div className="bg-[#121418] text-[#ffffff] border-[#333333]">

✅ CORRECT: Semantic Tailwind v4 tokens
<div className="bg-card text-card-foreground border-border/40">
```

```
❌ WRONG: Nested button inside Radix trigger without asChild
<DialogTrigger>
  <Button>Open Modal</Button>  <!-- Generates <button><button>...</button></button> error -->
</DialogTrigger>

✅ CORRECT: Use asChild polymorphism
<DialogTrigger asChild>
  <Button>Open Modal</Button>
</DialogTrigger>
```

```
❌ WRONG: Importing directly from Radix or Lucide
import * as Dialog from "@radix-ui/react-dialog";
import { Plus } from "lucide-react";

✅ CORRECT: Standard imports
import { Dialog, DialogTrigger, DialogContent } from "~/components/ui/dialog";
import { Plus } from "iconoir-react";
```

```
❌ WRONG: Desktop sidebar sticky top-0 or top-6 (overlaps navbar!)
<aside className="lg:sticky lg:top-6">

✅ CORRECT: 80px clearance (64px nav + 16px buffer)
<aside className="lg:sticky lg:top-20">
```
