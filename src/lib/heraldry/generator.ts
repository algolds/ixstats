import type {
  HeraldryComposition,
  Tincture,
  Division,
  OrdinaryType,
  ShieldShape,
  Attitude,
} from "./types";
import { TINCTURE_KIND } from "./constants";

export interface GenerationOptions {
  cultureGroup?: string;
  religion?: string;
  governmentType?: string;
  nationalColors?: string[]; // hex colors
}

const SHAPES: ShieldShape[] = [
  "heater",
  "kite",
  "round",
  "lozengoe",
  "oval",
  "renaissance",
  "pointed",
] as any;

const METALS: Tincture[] = ["or", "argent"];
const COLOURS: Tincture[] = ["gules", "azure", "vert", "purpure", "sable"];
const NEUTRALS: Tincture[] = ["ermine", "vair"];

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

// Pick random element from array
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

export function generateRandomComposition(options?: GenerationOptions): HeraldryComposition {
  // 1. Shield shape selection
  let shape: ShieldShape = "heater";
  if (options?.governmentType === "republic") {
    shape = "round";
  } else if (options?.governmentType === "monarchy") {
    shape = "renaissance";
  } else {
    shape = pick(SHAPES);
    if ((shape as string) === "lozengoe") {
      shape = "lozenge"; // Fix typo in array definition
    }
  }

  // 2. Division selection (weighted)
  let division: Division = "plain";
  const divRoll = Math.random();
  if (divRoll < 0.4) {
    division = "plain";
  } else if (divRoll < 0.55) {
    division = "per-pale";
  } else if (divRoll < 0.7) {
    division = "per-fess";
  } else if (divRoll < 0.8) {
    division = "quarterly";
  } else {
    division = pick(DIVISION_POOL);
  }

  // 3. Select background field colors following Rule of Tincture contrast
  const fieldTinctures: Tincture[] = [];
  const expectedCount =
    division === "plain" ? 1 : division === "quarterly" ? 4 : division === "per-saltire" ? 4 : 2;

  // Culture & national colors weight
  let preferredTinctures: Tincture[] = [];
  if (options?.nationalColors && options.nationalColors.length > 0) {
    preferredTinctures = options.nationalColors.map(hexToTincture);
  }

  const primaryBg = preferredTinctures[0] || pick([...METALS, ...COLOURS]);
  const primaryKind = TINCTURE_KIND[primaryBg] || "colour";

  fieldTinctures.push(primaryBg);

  for (let i = 1; i < expectedCount; i++) {
    if (i % 2 === 1) {
      // Alternate metal/color for adjacent sections to look gorgeous
      const oppositePool = primaryKind === "metal" ? COLOURS : METALS;
      fieldTinctures.push(preferredTinctures[i] || pick(oppositePool));
    } else {
      // Same kind as primary
      fieldTinctures.push(preferredTinctures[i] || primaryBg);
    }
  }

  // 4. Ordinaries (30% chance)
  const ordinaries = [];
  const hasOrdinary = Math.random() < 0.35;
  let ordinaryTincture: Tincture = primaryKind === "metal" ? "gules" : "or";

  if (hasOrdinary) {
    const ordType = pick(ORDINARY_POOL);
    // Contrasting color
    ordinaryTincture = primaryKind === "metal" ? pick(COLOURS) : pick(METALS);
    ordinaries.push({
      type: ordType,
      tincture: ordinaryTincture,
      lineStyle: "straight" as const,
    });
  }

  // 5. Charges (60% chance)
  const charges = [];
  const hasCharges = Math.random() < 0.7;

  if (hasCharges) {
    // Select a charge shape
    let chargeId = pick(CHARGE_POOL);

    // Culture biases
    if (options?.cultureGroup === "burgundian" || options?.cultureGroup === "frankish") {
      chargeId = "fleur-de-lis";
    } else if (options?.cultureGroup === "germanic") {
      chargeId = "eagle";
    } else if (options?.cultureGroup === "nordic") {
      chargeId = "lion";
    }

    // Determine contrasting tincture for the charge
    // If there is an ordinary, the charge sits either on it or around it.
    // If no ordinary, sits on the main background field.
    const backgroundKind = primaryKind;
    const chargeTincture = backgroundKind === "metal" ? pick(COLOURS) : pick(METALS);

    // Charge count (weighted: 1 (60%), 3 (30%), 2 (10%))
    let count = 1;
    const countRoll = Math.random();
    if (countRoll < 0.6) {
      count = 1;
    } else if (countRoll < 0.9) {
      count = 3;
    } else {
      count = 2;
    }

    charges.push({
      chargeId,
      position: count === 1 ? "fess-point" : "chief-point",
      count,
      tincture: chargeTincture,
      size: count === 1 ? 1.1 : 0.6,
      attitude:
        chargeId === "lion"
          ? ("rampant" as Attitude)
          : chargeId === "eagle"
            ? ("displayed" as Attitude)
            : undefined,
    });
  }

  // 6. External ornaments (15% chance for helm/motto)
  const externals: any = {};
  if (Math.random() < 0.15) {
    externals.helm = {
      type: "great-helm",
      facing: "affronte",
    };
  }
  if (options?.religion === "christian" && Math.random() < 0.5) {
    externals.motto = {
      text: "IN HOC SIGNO VINCES",
      position: "below",
    };
  } else if (options?.religion === "islamic" && Math.random() < 0.5) {
    externals.motto = {
      text: "ALHAMDULILLAH",
      position: "below",
    };
  }

  return {
    shield: {
      shape,
      field: {
        division,
        tinctures: fieldTinctures,
        lineStyle: "straight",
      },
      ordinaries,
      charges,
    },
    externals: Object.keys(externals).length > 0 ? externals : undefined,
  };
}
