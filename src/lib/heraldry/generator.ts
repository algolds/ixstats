import type {
  ChargeRef,
  ExternalOrnaments,
  HeraldryComposition,
  Tincture,
  Division,
  OrdinaryType,
  ShieldShape,
  Attitude,
} from "./types";
import { TINCTURE_KIND } from "./constants";

interface GenerationOptions {
  cultureGroup?: string;
  religion?: string;
  governmentType?: string;
  nationalColors?: string[]; // hex colors
}

const SHAPES: ShieldShape[] = [
  "heater",
  "kite",
  "round",
  "lozenge",
  "oval",
  "renaissance",
  "pointed",
];

const METALS: Tincture[] = ["or", "argent"];
const COLOURS: Tincture[] = ["gules", "azure", "vert", "purpure", "sable"];
const DIVISION_POOL: Division[] = [
  "plain",
  "per-pale",
  "per-fess",
  "per-bend",
  "per-bend-sinister",
  "quarterly",
  "per-saltire",
  "per-chevron",
];

const ORDINARY_POOL: OrdinaryType[] = [
  "chief",
  "fess",
  "pale",
  "bend",
  "bend-sinister",
  "chevron",
  "saltire",
  "cross",
  "bordure",
  "canton",
];

const CHARGE_POOL = ["star", "cross", "fleur-de-lis", "lion", "eagle"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Convert hex color to nearest heraldic tincture
function hexToTincture(hex: string): Tincture {
  const cleanHex = hex.toUpperCase().replace("#", "");

  // Basic color distance mapping
  if (cleanHex === "FFD700" || (cleanHex.startsWith("F") && cleanHex.endsWith("00"))) return "or";
  if (cleanHex === "FFFFFF" || cleanHex === "F0F0F0") return "argent";
  if (
    cleanHex.startsWith("C") ||
    cleanHex.startsWith("D") ||
    cleanHex.startsWith("E") ||
    cleanHex.startsWith("8B00")
  )
    return "gules";
  if (cleanHex.startsWith("0") || cleanHex.startsWith("1") || cleanHex.startsWith("2"))
    return "azure";
  if (cleanHex.startsWith("3") || cleanHex.startsWith("4") || cleanHex.startsWith("5"))
    return "vert";

  return "sable"; // fallback
}

/** Cumulative probability bounds; anything above the last bound picks from DIVISION_POOL. */
const DIVISION_WEIGHTS: Array<[upTo: number, division: Division]> = [
  [0.4, "plain"],
  [0.55, "per-pale"],
  [0.7, "per-fess"],
  [0.8, "quarterly"],
];

/** Number of field tinctures per division (default 2). */
const FIELD_TINCTURE_COUNT: Partial<Record<Division, number>> = {
  plain: 1,
  quarterly: 4,
  "per-saltire": 4,
};

const CULTURE_CHARGES: Record<string, string> = {
  burgundian: "fleur-de-lis",
  frankish: "fleur-de-lis",
  germanic: "eagle",
  nordic: "lion",
};

const CHARGE_ATTITUDES: Record<string, Attitude> = { lion: "rampant", eagle: "displayed" };

const MOTTOS: Record<string, string> = {
  christian: "IN HOC SIGNO VINCES",
  islamic: "ALHAMDULILLAH",
};

function pickShape(governmentType?: string): ShieldShape {
  if (governmentType === "republic") return "round";
  if (governmentType === "monarchy") return "renaissance";
  return pick(SHAPES);
}

function pickDivision(): Division {
  const roll = Math.random();
  return DIVISION_WEIGHTS.find(([upTo]) => roll < upTo)?.[1] ?? pick(DIVISION_POOL);
}

/** Charge count: 1 (60%), 3 (30%) or 2 (10%). */
function rollChargeCount(): number {
  const roll = Math.random();
  return roll < 0.6 ? 1 : roll < 0.9 ? 3 : 2;
}

/** A single charge in a tincture contrasting the field; cultures bias the charge shape. */
function rollCharge(cultureGroup: string | undefined, contrastPool: Tincture[]): ChargeRef {
  const rolledCharge = pick(CHARGE_POOL);
  const chargeId = CULTURE_CHARGES[cultureGroup ?? ""] ?? rolledCharge;
  const tincture = pick(contrastPool);
  const count = rollChargeCount();
  return {
    chargeId,
    position: count === 1 ? "fess-point" : "chief-point",
    count,
    tincture,
    size: count === 1 ? 1.1 : 0.6,
    attitude: CHARGE_ATTITUDES[chargeId],
  };
}

/** External ornaments: helm (15%) and a religious motto (50% when applicable). */
function rollExternals(religion: string | undefined): ExternalOrnaments {
  const externals: ExternalOrnaments = {};
  if (Math.random() < 0.15) externals.helm = { type: "great-helm", facing: "affronte" };
  const motto = MOTTOS[religion ?? ""];
  if (motto && Math.random() < 0.5) externals.motto = { text: motto, position: "below" };
  return externals;
}

export function generateRandomComposition(options?: GenerationOptions): HeraldryComposition {
  const shape = pickShape(options?.governmentType);
  const division = pickDivision();

  // Background field colors following the rule of tincture: adjacent sections alternate metal/colour.
  // National colors, when given, take precedence.
  const preferredTinctures = (options?.nationalColors ?? []).map(hexToTincture);
  const primaryBg = preferredTinctures[0] || pick([...METALS, ...COLOURS]);
  const primaryKind = TINCTURE_KIND[primaryBg] || "colour";
  const contrastPool = primaryKind === "metal" ? COLOURS : METALS;

  const fieldTinctures: Tincture[] = [primaryBg];
  for (let i = 1; i < (FIELD_TINCTURE_COUNT[division] ?? 2); i++) {
    fieldTinctures.push(preferredTinctures[i] || (i % 2 === 1 ? pick(contrastPool) : primaryBg));
  }

  // Ordinary (35% chance), in a contrasting tincture
  const ordinaries = [];
  if (Math.random() < 0.35) {
    ordinaries.push({
      type: pick(ORDINARY_POOL),
      tincture: pick(contrastPool),
      lineStyle: "straight" as const,
    });
  }

  const charges = Math.random() < 0.7 ? [rollCharge(options?.cultureGroup, contrastPool)] : [];
  const externals = rollExternals(options?.religion);

  return {
    shield: {
      shape,
      field: { division, tinctures: fieldTinctures, lineStyle: "straight" },
      ordinaries,
      charges,
    },
    externals: Object.keys(externals).length > 0 ? externals : undefined,
  };
}
