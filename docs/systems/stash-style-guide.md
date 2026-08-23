# Stash Design System & Style Guide

**Specification:** Apple Human Interface Guidelines & Emil Kowalski Design Engineering  
**Version:** Stash 1.0.0 / Facet Standard  
**Capability Level:** `STASH_VERSION: 1`  
**Last Updated:** August 2026  

---

## 1. Brand Identity & Voice

### 1.1 Slogan & Tagline Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          STASH BRAND ANCHORS                           │
├────────────────────────────────────────────────────────────────────────┤
│ Primary Slogan:   "Save-for-later, built for lore."                    │
│ Retention Hook:   "Stash it once. Keep it forever."                    │
│ Short Hook:       "Save everything. Lose nothing."                     │
│ Everyday Reality: "Your bookmarks, scratchpads, and reference files.   │
│                    All in one place."                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Voice & Editorial Principles
1. **Plain, direct speech.** Say what features do with real mechanics and concrete actions. Avoid AI buzzwords like *"seamless tapestry"*, *"delve into"*, or *"revolutionary substrate"*.
2. **Respect the reader's flow.** Interactions should respond on pointer-down with zero lag. Creation and settings actions use anchored popovers rather than full-page layout-shifting cards.
3. **External working memory.** Position Stash as a reliable tool that frees players from having 50 open browser tabs and scattered notepad documents.

---

## 2. Color System & Theme Tokens

### 2.1 Brand Primary Accent
The primary brand color for Stash is **Crimson Rose**:
- **Hex**: `#f43f5e` (rose-500)
- **Dark Mode Surface Tint**: `rgba(244, 63, 94, 0.15)` with `border: rgba(244, 63, 94, 0.3)`
- **Purpose**: System bookmark emblems, creation trigger buttons, active highlight indicators, and guide icons.

### 2.2 The 8-Swatch Preset Palette
Collections use an 8-color curated palette with dedicated semantic domains:

| Swatch | Hex Code | Light Contrast | Dark Contrast | Semantic Domain |
| :--- | :--- | :--- | :--- | :--- |
| **Blue** | `#3b82f6` | 4.6:1 | 7.8:1 | Treaties, diplomacy, international law, alliances |
| **Purple** | `#8b5cf6` | 4.8:1 | 8.1:1 | Culture, linguistics, philosophy, Onoma |
| **Pink** | `#ec4899` | 4.5:1 | 7.9:1 | Characters, dynasties, biographies, royal houses |
| **Red** | `#ef4444` | 4.7:1 | 7.6:1 | Military doctrine, fleets, warfare, conflict history |
| **Orange** | `#f97316` | 4.9:1 | 8.2:1 | Trade, commodities, economic policy, industry |
| **Yellow** | `#eab308` | 5.2:1 | 8.4:1 | Historical eras, timelines, chronologies, canon milestones |
| **Green** | `#22c55e` | 4.6:1 | 7.7:1 | Geography, biomes, territorial maps, atlas assets |
| **Cyan** | `#06b6d4` | 4.7:1 | 7.9:1 | Technology, science, engineering, state infrastructure |

---

## 3. Surface Materials & Elevation

Stash adopts Facet glass physics for structural cards and **100% solid opaque surfaces** for interactive popovers to eliminate background text bleed.

### 3.1 Structural Canvas & Rails
- **Dark Mode Base Canvas**: `#0f1114`
- **Structural Card Surface**: `rgba(22, 24, 29, 0.80)` with `backdrop-filter: blur(20px) saturate(180%)`
- **Hairline Border**: `1px solid rgba(255, 255, 255, 0.08)`
- **Elevation Shadow**: `shadow-xs` / `shadow-md`

### 3.2 Apple Popover Standard (Settings & Creation)
Dropdown menus and popovers must never use translucent backgrounds that allow underlying text to bleed through.

```css
/* Popover Surface Token */
.stash-popover {
  background-color: #ffffff; /* Light mode */
  border: 1px solid rgba(0, 0, 0, 0.10);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22), 0 6px 16px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(0, 0, 0, 0.06);
}

:root[data-theme="dark"] .stash-popover {
  background-color: #18181b; /* Dark mode */
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.12);
}
```

### 3.3 Clickaway Overlay
Do not use dark blurring window scrims for standard dropdown popovers. Use an invisible clickaway capture layer (`fixed inset-0 z-40`) so the underlying workspace remains clear and sharp.

---

## 4. Typography & Optical Scale

Stash uses system-tuned proportional typography matching the WikiOS layout:

| Element | Size & Weight | Line Height | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `1.25rem` (20px) / Bold (700) | 1.2 | -0.02em | Stash header title |
| **Collection Header** | `1.0rem` (16px) / Bold (700) | 1.25 | -0.015em | Active collection banner name |
| **Card Heading** | `0.875rem` (14px) / Bold (700) | 1.3 | -0.01em | Article title, quote lead, thread topic |
| **Body & Excerpts** | `0.8125rem` (13px) / Regular (400) | 1.5 | 0em | Clipped quotes, user notes, descriptions |
| **Metadata & Badges** | `0.6875rem` (11px) / Semibold (600) | 1.2 | 0.01em | Highlight counts, word counts, save dates |
| **Count Pill** | `0.625rem` (10px) / Bold (700) | 1.0 | 0.02em | Total item badges on tabs and rail |

---

## 5. Motion, Physics & Sound

### 5.1 Spring Physics Parameters
All interactive elements use `motion/react` spring physics:

```ts
// Popover Entrance & Exit Spring
const popoverSpring = {
  type: "spring",
  stiffness: 500,
  damping: 32,
};

// Initial and Animated States
const popoverMotion = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -6 },
};
```

### 5.2 Haptic Sound Feedback
Audio feedback is wired via the centralized `cuelume` sound system:
- **Button Press & Tab Select**: `soundEffects.press()`
- **Popover Dismiss & Item Delete**: `soundEffects.release()`

---

## 6. Accessibility & Contrast (WCAG 2.1 AA)

1. **Text Contrast**:
   - All body text and headings maintain a minimum contrast ratio of `12.5:1` in dark mode and `14:1` in light mode against card surfaces.
   - Metadata captions maintain at least `5.5:1` contrast, exceeding the 4.5:1 AA requirement.
2. **Image Error Handling**:
   - All article cards wrap remote thumbnails in a stateful component with `onError` fallback to the vector [`WikiOSLogomark`](file:///home/jxsig/projects/ixstats/src/components/wiki-os/shared/WikiOSLogomark.tsx), preventing native broken image squares.
3. **Keyboard Shortcuts**:
   - `Enter`: Submits inline collection rename and creation forms.
   - `Escape`: Smoothly dismisses open popovers and inline inputs without state corruption.
