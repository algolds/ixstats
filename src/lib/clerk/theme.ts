import type { Appearance } from "@clerk/types";

/**
 * Facet / Apple-Design system appearance configuration for Clerk components.
 * Binds directly to platform CSS variables (--color-bg-secondary, --color-text-primary,
 * --color-brand-primary, --color-border-primary), ensuring 100% theme compliance
 * across Light Mode, Dark Mode, and dynamic accent themes.
 */
export const facetClerkAppearance: Appearance = {
  variables: {
    colorPrimary: "var(--color-brand-primary, #6366f1)",
    colorBackground: "var(--color-bg-secondary, #16181d)",
    colorText: "var(--color-text-primary, #e4e4e7)",
    colorTextSecondary: "var(--color-text-muted, #a1a1aa)",
    colorInputBackground: "var(--color-input-bg, #1e2028)",
    colorInputText: "var(--color-text-primary, #e4e4e7)",
    borderRadius: "1rem", // 16px Apple squircle
    fontFamily: "var(--font-geist-sans), var(--font-sans), system-ui, sans-serif",
  },
  elements: {
    rootBox: "font-sans",
    card: "backdrop-blur-2xl border border-border bg-card/90 text-card-foreground rounded-2xl shadow-2xl",
    navbar: "border-r border-border bg-muted/30",
    navbarButton: "rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 active:scale-[0.98] transition-all",
    headerTitle: "font-bold tracking-tight text-foreground",
    headerSubtitle: "text-xs text-muted-foreground",
    formButtonPrimary: "rounded-xl bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] font-bold text-xs shadow-md transition-all",
    formFieldInput: "rounded-xl bg-input/20 border border-input text-xs text-foreground focus:border-ring transition-all",
    userButtonAvatarBox: "h-8 w-8 rounded-xl border border-border shadow-xs",
    userButtonPopoverCard: "backdrop-blur-2xl border border-border bg-popover/95 text-popover-foreground rounded-2xl shadow-2xl p-1",
    organizationSwitcherTrigger: "rounded-xl border border-border bg-card/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98] transition-all",
    organizationSwitcherPopoverCard: "backdrop-blur-2xl border border-border bg-popover/95 text-popover-foreground rounded-2xl shadow-2xl p-2",
    organizationProfile: "backdrop-blur-2xl border border-border shadow-2xl bg-card/90 text-card-foreground rounded-2xl",
    userProfile: "backdrop-blur-2xl border border-border shadow-2xl bg-card/90 text-card-foreground rounded-2xl",
  },
};
