// src/lib/military-equipment.ts
// Comprehensive military equipment database with atomic components
// Organized by era, manufacturer, and technology category

export const MILITARY_ERAS = {
  COLD_WAR: { label: "Cold War Era (1947-1991)", years: "1947-1991", techLevel: 60 },
  MODERN: { label: "Modern Era (1992-2010)", years: "1992-2010", techLevel: 75 },
  CONTEMPORARY: { label: "Contemporary (2011-2020)", years: "2011-2020", techLevel: 85 },
  ADVANCED: { label: "Advanced (2021+)", years: "2021+", techLevel: 95 },
  NEXT_GEN: { label: "Next Generation (Future)", years: "2030+", techLevel: 100 },
} as const;

export const DEFENSE_MANUFACTURERS = {
  // United States
  LOCKHEED_MARTIN: {
    name: "Lockheed Martin",
    country: "USA",
    specialty: ["aircraft", "missiles", "space"],
  },
  BOEING: { name: "Boeing", country: "USA", specialty: ["aircraft", "helicopters", "missiles"] },
  NORTHROP_GRUMMAN: {
    name: "Northrop Grumman",
    country: "USA",
    specialty: ["aircraft", "electronics", "ships"],
  },
  RAYTHEON: {
    name: "Raytheon Technologies",
    country: "USA",
    specialty: ["missiles", "electronics", "sensors"],
  },
  GENERAL_DYNAMICS: {
    name: "General Dynamics",
    country: "USA",
    specialty: ["tanks", "submarines", "munitions"],
  },

  // Europe
  BAE_SYSTEMS: { name: "BAE Systems", country: "UK", specialty: ["aircraft", "ships", "vehicles"] },
  AIRBUS: {
    name: "Airbus Defence",
    country: "EU",
    specialty: ["aircraft", "helicopters", "space"],
  },
  THALES: {
    name: "Thales Group",
    country: "France",
    specialty: ["electronics", "missiles", "radar"],
  },
  LEONARDO: {
    name: "Leonardo",
    country: "Italy",
    specialty: ["helicopters", "electronics", "weapons"],
  },
  RHEINMETALL: {
    name: "Rheinmetall",
    country: "Germany",
    specialty: ["vehicles", "weapons", "ammunition"],
  },

  // Russia
  UNITED_AIRCRAFT: {
    name: "United Aircraft Corporation",
    country: "Russia",
    specialty: ["aircraft", "helicopters"],
  },
  ALMAZ_ANTEY: { name: "Almaz-Antey", country: "Russia", specialty: ["missiles", "air_defense"] },
  URALVAGONZAVOD: { name: "Uralvagonzavod", country: "Russia", specialty: ["tanks", "vehicles"] },

  // Asia
  AVIC: { name: "AVIC", country: "China", specialty: ["aircraft", "helicopters", "missiles"] },
  NORINCO: { name: "NORINCO", country: "China", specialty: ["tanks", "vehicles", "weapons"] },
  MITSUBISHI_HEAVY: {
    name: "Mitsubishi Heavy Industries",
    country: "Japan",
    specialty: ["aircraft", "ships"],
  },
  KAI: {
    name: "Korea Aerospace Industries",
    country: "South Korea",
    specialty: ["aircraft", "helicopters"],
  },
  HAL: { name: "Hindustan Aeronautics", country: "India", specialty: ["aircraft", "helicopters"] },

  // Israel
  IAI: {
    name: "Israel Aerospace Industries",
    country: "Israel",
    specialty: ["aircraft", "missiles", "drones"],
  },
  ELBIT: {
    name: "Elbit Systems",
    country: "Israel",
    specialty: ["electronics", "drones", "sensors"],
  },

  // Other
  SAAB: { name: "Saab AB", country: "Sweden", specialty: ["aircraft", "missiles", "electronics"] },
  EMBRAER: { name: "Embraer Defense", country: "Brazil", specialty: ["aircraft", "electronics"] },
} as const;

// Aircraft Database
export const MILITARY_AIRCRAFT = {
  // Fighters - Modern/Contemporary
  F35_LIGHTNING: {
    name: "F-35 Lightning II",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Multirole Fighter",
    era: "ADVANCED",
    role: "air_superiority",
    crew: 1,
    speed: 1960, // km/h
    range: 2220, // km
    ceiling: 15240, // meters
    acquisitionCost: 80000000,
    maintenanceCost: 4000000,
    variants: ["F-35A (Air Force)", "F-35B (STOVL)", "F-35C (Navy)"],
  },
  F22_RAPTOR: {
    name: "F-22 Raptor",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Air Superiority Fighter",
    era: "CONTEMPORARY",
    role: "air_superiority",
    crew: 1,
    speed: 2414,
    range: 2960,
    ceiling: 19812,
    acquisitionCost: 150000000,
    maintenanceCost: 8000000,
  },
  RAFALE: {
    name: "Dassault Rafale",
    manufacturer: "THALES",
    category: "Multirole Fighter",
    era: "CONTEMPORARY",
    role: "multirole",
    crew: 1,
    speed: 1912,
    range: 3700,
    ceiling: 15240,
    acquisitionCost: 90000000,
    maintenanceCost: 5000000,
  },
  EUROFIGHTER: {
    name: "Eurofighter Typhoon",
    manufacturer: "AIRBUS",
    category: "Multirole Fighter",
    era: "CONTEMPORARY",
    role: "air_superiority",
    crew: 1,
    speed: 2495,
    range: 2900,
    ceiling: 19812,
    acquisitionCost: 120000000,
    maintenanceCost: 6000000,
  },
  F16_VIPER: {
    name: "F-16 Fighting Falcon",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Multirole Fighter",
    era: "MODERN",
    role: "multirole",
    crew: 1,
    speed: 2124,
    range: 4220,
    ceiling: 15240,
    acquisitionCost: 30000000,
    maintenanceCost: 2000000,
  },

  // Attack Aircraft
  A10_WARTHOG: {
    name: "A-10 Thunderbolt II",
    manufacturer: "NORTHROP_GRUMMAN",
    category: "Close Air Support",
    era: "COLD_WAR",
    role: "ground_attack",
    crew: 1,
    speed: 706,
    range: 4150,
    ceiling: 13716,
    acquisitionCost: 18000000,
    maintenanceCost: 1200000,
  },

  // Bombers
  B2_SPIRIT: {
    name: "B-2 Spirit",
    manufacturer: "NORTHROP_GRUMMAN",
    category: "Stealth Bomber",
    era: "MODERN",
    role: "strategic_bomber",
    crew: 2,
    speed: 1010,
    range: 11100,
    ceiling: 15240,
    acquisitionCost: 2100000000,
    maintenanceCost: 60000000,
  },
  B52_STRATOFORTRESS: {
    name: "B-52 Stratofortress",
    manufacturer: "BOEING",
    category: "Strategic Bomber",
    era: "COLD_WAR",
    role: "strategic_bomber",
    crew: 5,
    speed: 1047,
    range: 14080,
    ceiling: 15166,
    acquisitionCost: 84000000,
    maintenanceCost: 5000000,
  },

  // Transport
  C17_GLOBEMASTER: {
    name: "C-17 Globemaster III",
    manufacturer: "BOEING",
    category: "Strategic Transport",
    era: "MODERN",
    role: "transport",
    crew: 3,
    speed: 830,
    range: 4480,
    ceiling: 13716,
    acquisitionCost: 340000000,
    maintenanceCost: 15000000,
  },
  C130_HERCULES: {
    name: "C-130 Hercules",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Tactical Transport",
    era: "COLD_WAR",
    role: "transport",
    crew: 3,
    speed: 592,
    range: 3800,
    ceiling: 10060,
    acquisitionCost: 67000000,
    maintenanceCost: 3500000,
  },

  // Helicopters
  AH64_APACHE: {
    name: "AH-64 Apache",
    manufacturer: "BOEING",
    category: "Attack Helicopter",
    era: "MODERN",
    role: "attack_helicopter",
    crew: 2,
    speed: 293,
    range: 476,
    ceiling: 6400,
    acquisitionCost: 35000000,
    maintenanceCost: 2500000,
  },
  UH60_BLACKHAWK: {
    name: "UH-60 Black Hawk",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Utility Helicopter",
    era: "MODERN",
    role: "utility",
    crew: 4,
    speed: 296,
    range: 592,
    ceiling: 5790,
    acquisitionCost: 21000000,
    maintenanceCost: 1500000,
  },
} as const;

// Ships Database
export const MILITARY_SHIPS = {
  // Aircraft Carriers
  NIMITZ_CLASS: {
    name: "Nimitz-class Aircraft Carrier",
    manufacturer: "NORTHROP_GRUMMAN",
    category: "Supercarrier",
    era: "MODERN",
    displacement: 100000, // tons
    crew: 5680,
    aircraft: 90,
    speed: 56, // km/h
    range: "Unlimited (nuclear)",
    acquisitionCost: 8500000000,
    maintenanceCost: 500000000,
  },
  FORD_CLASS: {
    name: "Gerald R. Ford-class Carrier",
    manufacturer: "NORTHROP_GRUMMAN",
    category: "Supercarrier",
    era: "ADVANCED",
    displacement: 100000,
    crew: 4660,
    aircraft: 75,
    speed: 56,
    range: "Unlimited (nuclear)",
    acquisitionCost: 13000000000,
    maintenanceCost: 600000000,
  },

  // Destroyers
  ARLEIGH_BURKE: {
    name: "Arleigh Burke-class Destroyer",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Guided Missile Destroyer",
    era: "MODERN",
    displacement: 9200,
    crew: 380,
    speed: 56,
    range: 8300, // km
    acquisitionCost: 1850000000,
    maintenanceCost: 85000000,
  },
  ZUMWALT: {
    name: "Zumwalt-class Destroyer",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Stealth Destroyer",
    era: "CONTEMPORARY",
    displacement: 15742,
    crew: 175,
    speed: 56,
    range: 9000,
    acquisitionCost: 4400000000,
    maintenanceCost: 200000000,
  },

  // Submarines
  VIRGINIA_CLASS: {
    name: "Virginia-class Submarine",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Attack Submarine",
    era: "CONTEMPORARY",
    displacement: 7800,
    crew: 135,
    speed: 46,
    depth: 490, // meters
    acquisitionCost: 3300000000,
    maintenanceCost: 150000000,
  },
  OHIO_CLASS: {
    name: "Ohio-class Submarine",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Ballistic Missile Submarine",
    era: "MODERN",
    displacement: 18750,
    crew: 155,
    speed: 46,
    depth: 365,
    acquisitionCost: 2000000000,
    maintenanceCost: 100000000,
  },

  // Frigates
  CONSTELLATION_CLASS: {
    name: "Constellation-class Frigate",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Guided Missile Frigate",
    era: "ADVANCED",
    displacement: 7400,
    crew: 200,
    speed: 48,
    range: 11000,
    acquisitionCost: 1200000000,
    maintenanceCost: 60000000,
  },
} as const;

// Tanks & Armored Vehicles
export const MILITARY_VEHICLES = {
  // Main Battle Tanks
  M1_ABRAMS: {
    name: "M1 Abrams",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Main Battle Tank",
    era: "MODERN",
    crew: 4,
    speed: 67, // km/h
    range: 426, // km
    armament: "120mm smoothbore cannon",
    acquisitionCost: 8900000,
    maintenanceCost: 500000,
  },
  LEOPARD_2: {
    name: "Leopard 2",
    manufacturer: "RHEINMETALL",
    category: "Main Battle Tank",
    era: "MODERN",
    crew: 4,
    speed: 68,
    range: 450,
    armament: "120mm smoothbore cannon",
    acquisitionCost: 7500000,
    maintenanceCost: 450000,
  },
  CHALLENGER_2: {
    name: "Challenger 2",
    manufacturer: "BAE_SYSTEMS",
    category: "Main Battle Tank",
    era: "MODERN",
    crew: 4,
    speed: 59,
    range: 550,
    armament: "120mm rifled cannon",
    acquisitionCost: 6500000,
    maintenanceCost: 400000,
  },

  // Infantry Fighting Vehicles
  BRADLEY_IFV: {
    name: "M2 Bradley",
    manufacturer: "BAE_SYSTEMS",
    category: "Infantry Fighting Vehicle",
    era: "MODERN",
    crew: 3,
    troops: 6,
    speed: 66,
    range: 402,
    armament: "25mm autocannon",
    acquisitionCost: 4200000,
    maintenanceCost: 250000,
  },

  // Armored Personnel Carriers
  STRYKER: {
    name: "Stryker",
    manufacturer: "GENERAL_DYNAMICS",
    category: "Armored Personnel Carrier",
    era: "CONTEMPORARY",
    crew: 2,
    troops: 9,
    speed: 97,
    range: 531,
    acquisitionCost: 4900000,
    maintenanceCost: 300000,
  },

  // Artillery
  M109_PALADIN: {
    name: "M109 Paladin",
    manufacturer: "BAE_SYSTEMS",
    category: "Self-Propelled Howitzer",
    era: "MODERN",
    crew: 4,
    speed: 56,
    range: 349,
    armament: "155mm howitzer",
    firingRange: 30000, // meters
    acquisitionCost: 2700000,
    maintenanceCost: 180000,
  },
  HIMARS: {
    name: "HIMARS",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Multiple Rocket Launcher",
    era: "CONTEMPORARY",
    crew: 3,
    speed: 85,
    range: 480,
    armament: "6x GMLRS rockets",
    firingRange: 80000,
    acquisitionCost: 5100000,
    maintenanceCost: 350000,
  },
} as const;

// Weapon Systems
export const WEAPON_SYSTEMS = {
  // Air Defense
  PATRIOT: {
    name: "MIM-104 Patriot",
    manufacturer: "RAYTHEON",
    category: "Surface-to-Air Missile",
    era: "MODERN",
    range: 160000, // meters
    altitude: 24400, // meters
    acquisitionCost: 1100000000, // per battery
    maintenanceCost: 50000000,
  },
  THAAD: {
    name: "THAAD",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Ballistic Missile Defense",
    era: "CONTEMPORARY",
    range: 200000,
    altitude: 150000,
    acquisitionCost: 3000000000,
    maintenanceCost: 120000000,
  },
  IRON_DOME: {
    name: "Iron Dome",
    manufacturer: "IAI",
    category: "Short-Range Air Defense",
    era: "CONTEMPORARY",
    range: 70000,
    altitude: 10000,
    acquisitionCost: 50000000,
    maintenanceCost: 3000000,
  },

  // Naval Weapons
  AEGIS: {
    name: "Aegis Combat System",
    manufacturer: "LOCKHEED_MARTIN",
    category: "Naval Combat System",
    era: "MODERN",
    acquisitionCost: 500000000,
    maintenanceCost: 25000000,
  },

  // Cruise Missiles
  TOMAHAWK: {
    name: "BGM-109 Tomahawk",
    manufacturer: "RAYTHEON",
    category: "Cruise Missile",
    era: "MODERN",
    range: 2500000, // meters
    speed: 880, // km/h
    acquisitionCost: 1900000, // per missile
  },
} as const;

// Unit Type Templates
export const UNIT_TEMPLATES = {
  // Army
  INFANTRY_DIVISION: {
    name: "Infantry Division",
    type: "division",
    branch: "army",
    personnel: 15000,
    typical_equipment: ["M1_ABRAMS", "BRADLEY_IFV", "STRYKER", "M109_PALADIN"],
  },
  ARMORED_DIVISION: {
    name: "Armored Division",
    type: "division",
    branch: "army",
    personnel: 12000,
    typical_equipment: ["M1_ABRAMS", "BRADLEY_IFV", "M109_PALADIN"],
  },
  AIRBORNE_BRIGADE: {
    name: "Airborne Brigade",
    type: "brigade",
    branch: "army",
    personnel: 3500,
    typical_equipment: ["UH60_BLACKHAWK", "C130_HERCULES"],
  },

  // Navy
  CARRIER_STRIKE_GROUP: {
    name: "Carrier Strike Group",
    type: "fleet",
    branch: "navy",
    personnel: 7500,
    typical_equipment: ["NIMITZ_CLASS", "ARLEIGH_BURKE", "VIRGINIA_CLASS"],
  },
  DESTROYER_SQUADRON: {
    name: "Destroyer Squadron",
    type: "squadron",
    branch: "navy",
    personnel: 2000,
    typical_equipment: ["ARLEIGH_BURKE"],
  },

  // Air Force
  FIGHTER_WING: {
    name: "Fighter Wing",
    type: "wing",
    branch: "air_force",
    personnel: 5000,
    typical_equipment: ["F35_LIGHTNING", "F22_RAPTOR", "F16_VIPER"],
  },
  BOMBER_SQUADRON: {
    name: "Bomber Squadron",
    type: "squadron",
    branch: "air_force",
    personnel: 1200,
    typical_equipment: ["B2_SPIRIT", "B52_STRATOFORTRESS"],
  },
  TRANSPORT_SQUADRON: {
    name: "Transport Squadron",
    type: "squadron",
    branch: "air_force",
    personnel: 800,
    typical_equipment: ["C17_GLOBEMASTER", "C130_HERCULES"],
  },
} as const;

// Helper functions
export function getEquipmentByEra(era: keyof typeof MILITARY_ERAS) {
  const aircraft = Object.entries(MILITARY_AIRCRAFT).filter(([_, v]) => v.era === era);
  const ships = Object.entries(MILITARY_SHIPS).filter(([_, v]) => v.era === era);
  const vehicles = Object.entries(MILITARY_VEHICLES).filter(([_, v]) => v.era === era);

  return { aircraft, ships, vehicles };
}

export function getEquipmentByManufacturer(manufacturer: keyof typeof DEFENSE_MANUFACTURERS) {
  const aircraft = Object.entries(MILITARY_AIRCRAFT).filter(
    ([_, v]) => v.manufacturer === manufacturer
  );
  const ships = Object.entries(MILITARY_SHIPS).filter(([_, v]) => v.manufacturer === manufacturer);
  const vehicles = Object.entries(MILITARY_VEHICLES).filter(
    ([_, v]) => v.manufacturer === manufacturer
  );
  const weapons = Object.entries(WEAPON_SYSTEMS).filter(
    ([_, v]) => v.manufacturer === manufacturer
  );

  return { aircraft, ships, vehicles, weapons };
}

export function getAllEquipment() {
  return {
    aircraft: MILITARY_AIRCRAFT,
    ships: MILITARY_SHIPS,
    vehicles: MILITARY_VEHICLES,
    weapons: WEAPON_SYSTEMS,
  };
}

// Re-export extended database for full catalog access
export * from "./military-equipment-extended";
