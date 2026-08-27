"use client";

// src/app/labs/onoma/components/shared/onoma-icon-families.tsx
// Onoma Lab — Remix Icons Domain Iconography Architecture
// High-precision vector mapping for dictionary taxonomies, categories, and subtypes

import React from "react";
import {
  RiPlanetLine,
  RiVipCrownLine,
  RiNodeTree,
  RiSunLine,
  RiSkull2Line,
  RiAncientGateLine,
  RiBuilding4Line,
  RiLandscapeLine,
  RiShieldStarLine,
  RiBriefcase4Line,
  RiUser3Line,
  RiSwordLine,
  RiSailboatLine,
  RiGobletLine,
  RiRestaurantLine,
  RiGamepadLine,
  RiMagicLine,
  RiBook2Line,
} from "react-icons/ri";

export type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * Resolves the thematic Remix Icon for a dictionary or domain taxonomy subtype.
 */
export function getDomainIconByFamily(dict?: {
  id?: string;
  category?: string;
  title?: string;
}): IconComponent {
  if (!dict) return RiBook2Line;

  const id = (dict.id || "").toLowerCase();
  const cat = (dict.category || "").toLowerCase();
  const title = (dict.title || "").toLowerCase();

  // 1. Celestial / Astronomy / Planets & Satellites
  if (
    cat.includes("planet") ||
    cat.includes("space") ||
    cat.includes("celestial") ||
    cat.includes("astro") ||
    id.includes("planet") ||
    title.includes("planet") ||
    title.includes("satellite") ||
    title.includes("star") ||
    title.includes("moon")
  ) {
    return RiPlanetLine;
  }

  // 2. Rulers, Emperors, Monarchs, Sovereign Governance
  if (
    cat.includes("ruler") ||
    cat.includes("monarch") ||
    cat.includes("emperor") ||
    id.includes("emperor") ||
    id.includes("king") ||
    title.includes("emperor") ||
    title.includes("king") ||
    title.includes("monarch") ||
    title.includes("ruler") ||
    title.includes("caesar")
  ) {
    return RiVipCrownLine;
  }

  // 3. Lineages, Gens, Clans, Dynasties (Genealogy & Family Trees)
  if (
    cat.includes("gens") ||
    cat.includes("clan") ||
    cat.includes("lineage") ||
    cat.includes("dynasty") ||
    id.includes("gens") ||
    id.includes("clan") ||
    id.includes("dynasty") ||
    title.includes("gens") ||
    title.includes("clan") ||
    title.includes("dynasty") ||
    title.includes("lineage") ||
    title.includes("surname") ||
    title.includes("family")
  ) {
    return RiNodeTree;
  }

  // 4. Angels, Heralds, Celestial Messengers
  if (
    cat.includes("angel") ||
    id.includes("angel") ||
    title.includes("angel") ||
    title.includes("seraph") ||
    title.includes("cherub")
  ) {
    return RiSunLine;
  }

  // 5. Demons, Monsters, Fiends, Mythological Creatures, Beasts
  if (
    cat.includes("creature") ||
    cat.includes("monster") ||
    cat.includes("demon") ||
    cat.includes("fiend") ||
    cat.includes("undead") ||
    id.includes("demon") ||
    id.includes("monster") ||
    id.includes("creature") ||
    title.includes("demon") ||
    title.includes("monster") ||
    title.includes("beast") ||
    title.includes("creature") ||
    title.includes("devil") ||
    title.includes("fiend")
  ) {
    return RiSkull2Line;
  }

  // 6. Deities, Gods, Goddesses, Cults, Mythology, Temples
  if (
    cat.includes("deity") ||
    cat.includes("god") ||
    cat.includes("theolog") ||
    cat.includes("myth") ||
    cat.includes("pantheon") ||
    id.includes("deit") ||
    id.includes("god") ||
    title.includes("deit") ||
    title.includes("god") ||
    title.includes("theolog") ||
    title.includes("pantheon") ||
    title.includes("cult")
  ) {
    return RiAncientGateLine;
  }

  // 7. Military, Armed Units, Regiments, Mercenaries, Operations
  if (
    cat.includes("military") ||
    cat.includes("regiment") ||
    cat.includes("unit") ||
    cat.includes("war") ||
    id.includes("military") ||
    id.includes("mercenary") ||
    title.includes("military") ||
    title.includes("regiment") ||
    title.includes("brigade") ||
    title.includes("mercenary")
  ) {
    return RiSwordLine;
  }

  // 8. Naval Ships, Fleets, Vessels, Submarines
  if (
    cat.includes("ship") ||
    cat.includes("naval") ||
    cat.includes("fleet") ||
    id.includes("ship") ||
    title.includes("ship") ||
    title.includes("naval") ||
    title.includes("carrier") ||
    title.includes("fleet") ||
    title.includes("submarine")
  ) {
    return RiSailboatLine;
  }

  // 9. Taverns, Inns, Brew Houses, Establishments
  if (
    cat.includes("tavern") ||
    cat.includes("brew") ||
    id.includes("tavern") ||
    title.includes("tavern") ||
    title.includes("inn") ||
    title.includes("brew")
  ) {
    return RiGobletLine;
  }

  // 10. Cuisine, Foods, Traditional Dining
  if (
    cat.includes("cuisine") ||
    cat.includes("food") ||
    id.includes("cuisine") ||
    title.includes("cuisine") ||
    title.includes("food")
  ) {
    return RiRestaurantLine;
  }

  // 11. Sports, Games, Contests
  if (
    cat.includes("sport") ||
    cat.includes("game") ||
    id.includes("sport") ||
    title.includes("sport") ||
    title.includes("game")
  ) {
    return RiGamepadLine;
  }

  // 12. Magic, Arcane Orders, Mystics
  if (
    cat.includes("magic") ||
    cat.includes("arcane") ||
    cat.includes("mystic") ||
    id.includes("magic") ||
    id.includes("mystic") ||
    title.includes("magic") ||
    title.includes("mystic") ||
    title.includes("spell")
  ) {
    return RiMagicLine;
  }

  // 13. Geography, Landmarks, Mountains, Rivers, Islands
  if (
    cat.includes("geo") ||
    cat.includes("landmark") ||
    cat.includes("nature") ||
    id.includes("river") ||
    id.includes("mountain") ||
    id.includes("island") ||
    title.includes("river") ||
    title.includes("mountain") ||
    title.includes("island") ||
    title.includes("sea") ||
    title.includes("lake") ||
    title.includes("landmark")
  ) {
    return RiLandscapeLine;
  }

  // 14. Cities, Towns, Settlements, Colonies, Administrative Places
  if (
    cat.includes("place") ||
    cat.includes("city") ||
    cat.includes("settlement") ||
    cat.includes("town") ||
    id.includes("cit") ||
    id.includes("place") ||
    title.includes("cit") ||
    title.includes("settlement") ||
    title.includes("town") ||
    title.includes("colony") ||
    title.includes("toponym")
  ) {
    return RiBuilding4Line;
  }

  // 15. States, Polities, Nations, Kingdoms, Empires
  if (
    cat.includes("nation") ||
    cat.includes("polity") ||
    cat.includes("state") ||
    cat.includes("country") ||
    id.includes("state") ||
    id.includes("nation") ||
    title.includes("state") ||
    title.includes("empire") ||
    title.includes("kingdom") ||
    title.includes("republic") ||
    title.includes("nation")
  ) {
    return RiShieldStarLine;
  }

  // 16. Guilds, Companies, Corporations, Trade, Merchants
  if (
    cat.includes("econ") ||
    cat.includes("trade") ||
    cat.includes("guild") ||
    cat.includes("corp") ||
    id.includes("guild") ||
    id.includes("corp") ||
    title.includes("guild") ||
    title.includes("corp") ||
    title.includes("company") ||
    title.includes("merchant")
  ) {
    return RiBriefcase4Line;
  }

  // 17. General People, Given Names, Characters
  if (
    cat.includes("person") ||
    cat.includes("people") ||
    cat.includes("name") ||
    id.includes("person") ||
    id.includes("people") ||
    title.includes("person") ||
    title.includes("people") ||
    title.includes("character") ||
    title.includes("given") ||
    title.includes("first name")
  ) {
    return RiUser3Line;
  }

  return RiBook2Line;
}

export const getOnomaDomainIcon = getDomainIconByFamily;
