// src/lib/onoma/cultural-profiles.ts
// Onoma Lab — Cultural & Linguistic Seed Data

import type { CulturalProfile, NameCategory } from "./types";
import rawProfiles from "./cultural-profiles.json";

export const CULTURAL_PROFILES: Record<
  CulturalProfile,
  Record<NameCategory, string[]>
> = rawProfiles as Record<CulturalProfile, Record<NameCategory, string[]>>;
