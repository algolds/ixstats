// ---------------------------------------------------------------------------
// Version Registry — single source of truth for all platform version info.
//
// See revision.md ("IxStates Versioning & Release Architecture"). Every UI,
// API, changelog, diagnostic, and doc must read version info from here — no
// version strings hardcoded elsewhere.
//
// Granularity rules:
//   • Platform                     → Major.Minor.Patch + permanent epoch
//                                     release name + channel
//   • Apps / Engines / Systems /   → a single monotonic capability integer.
//     Design                         Increment only on a user-noticeable
//                                     capability leap; fixes ride the platform
//                                     patch + build id.
//
// Components that inherit the platform version (not independently versioned):
// IxForum, IxTime/IxnayID, Labs, Navigation Hubs.
// ---------------------------------------------------------------------------

import { BUILD_VERSION } from "./buildVersion.generated";

// Re-export so other files can import a stable module path.
export { BUILD_VERSION };

export type ReleaseChannel = "Developer" | "Alpha" | "Beta" | "Release Candidate" | "Stable";

export const VERSIONS = {
  platform: {
    major: 1,
    minor: 0,
    patch: 5,
    release: "Ogma",
    channel: "Alpha" as ReleaseChannel,
  },

  // Apps — own brand, ship/break independently.
  apps: {
    ixworld: 1,
    wikios: 1, // Canvas nests under WikiOS (see subSystems.canvas)
    ixvault: 1,
  },

  // Engines — internal-only simulation cores (surfaced in the Dev panel).
  engines: {
    mycountry: 1, // nation-scoped deterministic sim
    concord: 1, // living-world sim (time, diplomacy, crises, NPCs)
    atlas: 1, // spatial foundation (worldgen, geo, maps) — powers IxWorld
  },

  // UI / feature systems — independent, user-facing.
  systems: {
    mycountry: 1, // public-facing executive command UI
    builder: 1,
    thinkpages: 1,
    achievements: 1, // incl. LoreWards
    stash: 1, // save-for-later wiki articles (was "LoreStash")
    repository: 2, // WikiOS Commons image explorer
    halo: 1, // global contextual overlay (was "Dynamic Island")
  },

  // Design system.
  design: {
    facet: 1, // glass/refraction/depth design language (was "Glass Physics")
  },

  // WikiOS sub-systems (nested, not top-level).
  subSystems: {
    canvas: 1, // visual wiki editor
  },

  build: BUILD_VERSION,
} as const;

// ---------------------------------------------------------------------------
// Derived display strings — the only thing UI components should import.
// ---------------------------------------------------------------------------

const p = VERSIONS.platform;

/** Public platform version, e.g. "1.0 Ogma". */
export const APP_VERSION = `${p.major}.${p.minor} ${p.release}`;
/** Full SemVer platform string, e.g. "1.0.0". */
export const PLATFORM_VERSION = `${p.major}.${p.minor}.${p.patch}`;
/** Permanent epoch release name, e.g. "Ogma". */
export const RELEASE_NAME = p.release;
/** Current release channel, e.g. "Alpha". */
export const CHANNEL: ReleaseChannel = p.channel;

// Apps (single integer, rendered as "v{n}").
export const IXWORLD_VERSION = String(VERSIONS.apps.ixworld);
export const WIKIOS_VERSION = String(VERSIONS.apps.wikios);
export const IXVAULT_VERSION = String(VERSIONS.apps.ixvault);

// IxForum is NOT independently versioned yet — it inherits the platform
// version (Major.Minor) until it is promoted to a first-class App.
export const IXFORUM_VERSION = `${p.major}.${p.minor}`;

// Engines (internal — surfaced in the Developer panel only).
export const MYCOUNTRY_ENGINE_VERSION = String(VERSIONS.engines.mycountry);
export const CONCORD_ENGINE_VERSION = String(VERSIONS.engines.concord);
export const ATLAS_ENGINE_VERSION = String(VERSIONS.engines.atlas);

// UI / feature systems (single integer).
export const MYCOUNTRY_VERSION = String(VERSIONS.systems.mycountry);
export const BUILDER_VERSION = String(VERSIONS.systems.builder);
export const THINKPAGES_VERSION = String(VERSIONS.systems.thinkpages);
export const ACHIEVEMENTS_VERSION = String(VERSIONS.systems.achievements);
export const STASH_VERSION = String(VERSIONS.systems.stash);
export const REPOSITORY_VERSION = String(VERSIONS.systems.repository);
export const HALO_VERSION = String(VERSIONS.systems.halo);

// Design system.
export const FACET_VERSION = String(VERSIONS.design.facet);

// WikiOS sub-systems.
export const CANVAS_VERSION = String(VERSIONS.subSystems.canvas);

// ---------------------------------------------------------------------------
// Welcome / onboarding modal versions (used for localStorage version-gating).
// These are FEATURE GATES, not product identity — keep them separate from the
// registry above. Bump one of these to re-show its welcome modal.
// ---------------------------------------------------------------------------

export const STASHES_WELCOME_VERSION = "1.0";
export const ATOMIC_WELCOME_VERSION = "1.0";
export const ATOMIC_ECONOMY_WELCOME_VERSION = "1.0";
export const MAP_EDITOR_WELCOME_VERSION = "1.0";
