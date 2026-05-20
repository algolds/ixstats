# Plan: Builder Improvements

## 1. Dynamic Getting Started Tips (BuilderOnboardingBanner)

**File:** `src/app/builder/components/BuilderOnboardingBanner.tsx`

### Changes:
- Add `activeSection` prop to the component interface
- Replace static `TIPS` array with `SECTION_TIPS` map keyed by `BuilderSection`
- Use per-section localStorage key: `builder_onboarding_banner_dismissed_${activeSection}`
- Update header subtitle dynamically based on current section
- Hide "Import from Wiki" button when already on import section

### Section-specific tips:
```ts
const SECTION_TIPS: Record<BuilderSection, { title: string; description: string }[]> = {
  foundation: [
    { title: "Start with a Template", description: "Select an existing nation as your starting template, or begin from scratch." },
    { title: "Name Your Nation", description: "Give your nation a unique name that will appear across all sections." },
    { title: "Import from Wiki", description: "Already have a nation on IxWiki or IIWiki? Import your data to get started faster." },
  ],
  identity: [
    { title: "Define Your Flag", description: "Upload or describe your national flag and coat of arms." },
    { title: "Set National Description", description: "Write a compelling overview of your nation's history and culture." },
    { title: "Choose Government Type", description: "Select the form of government that best fits your nation." },
  ],
  government: [
    { title: "Structure Your Branches", description: "Define the executive, legislative, and judicial branches of your government." },
    { title: "Define Powers & Limits", description: "Set the scope of governmental authority and constitutional constraints." },
    { title: "Set Legal System", description: "Choose your legal framework and judicial processes." },
  ],
  economics: [
    { title: "Set Economic System", description: "Define your nation's economic model — free market, planned, or mixed." },
    { title: "Configure Currency & Trade", description: "Establish your currency, trade policies, and economic partnerships." },
    { title: "Define Budget Priorities", description: "Allocate government spending across sectors like military, education, and infrastructure." },
  ],
  preview: [
    { title: "Review Your Nation", description: "Check all sections to ensure your nation is complete and consistent." },
    { title: "Make Final Adjustments", description: "Go back to any section to refine details before publishing." },
    { title: "Create Your Nation", description: "Once satisfied, finalize and create your nation on the wiki." },
  ],
  import: [
    { title: "Choose Wiki Source", description: "Select from IxWiki, IIWiki, or AltHistory Wiki as your data source." },
    { title: "Search for Your Nation", description: "Use the search bar to find your existing nation page on the wiki." },
    { title: "Review & Import Data", description: "Preview the parsed data before importing it into your builder." },
  ],
};
```

**File:** `src/app/builder/components/BuilderRouter.tsx` (line 311)
- Pass `activeSection` prop to `BuilderOnboardingBanner`:
```tsx
<BuilderOnboardingBanner onOpenImport={() => handleNavigate("import")} activeSection={activeSection} />
```

---

## 2. Remove "Choose Wiki Source" Header from WikiSourceSelector

**File:** `src/app/builder/import/_components/WikiSourceSelector.tsx`

### Changes:
- Remove `GlassCardHeader` section (lines 38-58) containing:
  - `<h2>Choose Wiki Source</h2>`
  - `<p>Select your preferred wiki encyclopedia</p>`
- Keep `GlassCardContent` with the 3-column wiki site cards grid
- The step header (`BuilderSectionHero`) already shows "Import from Wiki" so this is redundant

### Before:
```tsx
<GlassCard depth="elevated" blur="medium" theme="neutral" motionPreset="slide" className="mb-8">
  <GlassCardHeader>
    <div className="flex items-center gap-3">
      <div className="rounded-lg p-2" style={{...}}>
        <Globe className="h-5 w-5" style={{...}} />
      </div>
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Choose Wiki Source
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Select your preferred wiki encyclopedia
        </p>
      </div>
    </div>
  </GlassCardHeader>
  <GlassCardContent>
    {/* grid of wiki cards */}
  </GlassCardContent>
</GlassCard>
```

### After:
```tsx
<GlassCard depth="elevated" blur="medium" theme="neutral" motionPreset="slide" className="mb-8">
  <GlassCardContent>
    {/* grid of wiki cards - unchanged */}
  </GlassCardContent>
</GlassCard>
```

---

## 3. Fix Builder Header Padding on Nav Reactivation

**File:** `src/app/builder/layout.tsx`

### Problem:
The main nav bar is `position: fixed` with `h-16` (64px) height. When scrolling up, it slides back in and overlays the builder content without any padding compensation.

### Solution:
Add a `:has()` CSS rule that applies `padding-top: 4rem` to the builder content when nav is visible.

**Changes to `layout.tsx`** - Add to the `<style jsx global>` block:
```css
/* When nav is visible, add top padding to builder content */
body:has([data-builder-headless][data-show-nav="true"]) [data-builder-content] {
  padding-top: 4rem;
  transition: padding-top 0.3s ease-in-out;
}
```

**File:** `src/app/builder/components/BuilderSidebarLayout.tsx`

Add `data-builder-content` attribute to the main content wrapper:
```tsx
<div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4" data-builder-content>
```

This ensures smooth padding transition when the nav slides back in on scroll-up, preventing content from being hidden behind the navigation bar.
