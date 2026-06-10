// Thin re-export so other files can import a stable module path.
export { BUILD_VERSION } from "./buildVersion.generated";

// ---------------------------------------------------------------------------
// Subsystem versions — single source of truth
// ---------------------------------------------------------------------------

export const APP_VERSION = "1.0 Ogma";
export const WIKIOS_VERSION = "1.0 Ogma";
export const IXWORLD_VERSION = APP_VERSION;
export const IXFORUM_VERSION = "1.0-alpha";
export const MYCOUNTRY_VERSION = "1.0";
export const BUILDER_VERSION = "1.0";
export const CANVAS_VERSION = "1.0";

// ---------------------------------------------------------------------------
// Welcome / onboarding modal versions (used for localStorage version-gating)
// ---------------------------------------------------------------------------

export const STASHES_WELCOME_VERSION = "1.0";
export const ATOMIC_WELCOME_VERSION = "1.0";
export const ATOMIC_ECONOMY_WELCOME_VERSION = "1.0";
export const MAP_EDITOR_WELCOME_VERSION = "1.0";
