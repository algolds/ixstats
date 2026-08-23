// src/components/wiki-os/margin/index.ts
// Barrel exports for WikiOS Margin suite.

export { WikiMarginDrawer, type MarginTab } from "./WikiMarginDrawer";
export { MarginGutterPins, type GutterPinItem } from "./MarginGutterPins";
export { SelectionCapsule, type SelectionPayload, HIGHLIGHT_PALETTE } from "./SelectionCapsule";
export { MarginThreadsTab, THREAD_CATEGORIES, LORE_DIMENSIONS } from "./tabs/MarginThreadsTab";
export { MarginMarkupTab } from "./tabs/MarginMarkupTab";
export { MarginInspectTab, type PageTier } from "./tabs/MarginInspectTab";
export { MarginShareModal } from "./modals/MarginShareModal";
export { MarginUserAvatar, getInitials, type CommentAuthor } from "./shared/MarginUserAvatar";
