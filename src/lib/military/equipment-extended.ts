// src/lib/military/equipment-extended.ts
import rawEquipment from "./equipment-extended.json";

export const ATTACK_AIRCRAFT = rawEquipment.ATTACK_AIRCRAFT as Record<string, any>;
export const BOMBERS = rawEquipment.BOMBERS as Record<string, any>;
export const EXPANDED_MILITARY_DATABASE = rawEquipment.EXPANDED_MILITARY_DATABASE as Record<
  string,
  any
>;
export const FIGHTERS_GENERATION_4_5 = rawEquipment.FIGHTERS_GENERATION_4_5 as Record<string, any>;
export const FIGHTERS_GENERATION_5 = rawEquipment.FIGHTERS_GENERATION_5 as Record<string, any>;
export const GROUND_VEHICLES = rawEquipment.GROUND_VEHICLES as Record<string, any>;
export const HELICOPTERS = rawEquipment.HELICOPTERS as Record<string, any>;
export const NAVAL_SHIPS = rawEquipment.NAVAL_SHIPS as Record<string, any>;
export const TRANSPORT_AIRCRAFT = rawEquipment.TRANSPORT_AIRCRAFT as Record<string, any>;
export const WEAPON_SYSTEMS_EXTENDED = rawEquipment.WEAPON_SYSTEMS_EXTENDED as Record<string, any>;

export default rawEquipment;
