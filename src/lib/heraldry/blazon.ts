import { DIVISION_SECTIONS_COUNT } from "./constants";
import type {
  Division,
  HeraldryComposition,
  FieldConfig,
  OrdinaryConfig,
  ChargeRef,
  ExternalOrnaments,
} from "./types";

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function numberToWord(n: number): string {
  const words: Record<number, string> = {
    1: "a",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  };
  return words[n] ?? String(n);
}

function pluralize(name: string, count: number): string {
  if (count <= 1) return name;
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("ch") || name.endsWith("sh")) {
    return name + "es";
  }
  return name + "s";
}

/** "Or", "Or and Azure", "Or, Azure and Gules". */
function listTinctures(tinctures: string[]): string {
  const names = tinctures.map(capitalize);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
    : (names[0] ?? "");
}

/** The first two tinctures when the pieces alternate them (A, B, A, B, ...), otherwise all of them. */
function alternating(tinctures: string[]): string[] {
  const pair = tinctures.slice(0, 2);
  return tinctures.every((t, i) => t === pair[i % 2]) ? pair : tinctures;
}

/** "Barry of six Or and Azure": the piece count comes from the division's section count. */
const ofCount =
  (name: string, division: Division) =>
  (tinctures: string[]): string =>
    `${name} of ${numberToWord(DIVISION_SECTIONS_COUNT[division])} ${listTinctures(alternating(tinctures))}`;

const named =
  (name: string) =>
  (tinctures: string[]): string =>
    `${name} ${listTinctures(alternating(tinctures))}`;

function blazonQuarterly(tinctures: string[]): string {
  if (tinctures.length < 4) return named("Quarterly")(tinctures);
  if (tinctures[0] === tinctures[3] && tinctures[1] === tinctures[2]) {
    return `Quarterly, first and fourth ${capitalize(tinctures[0]!)}, second and third ${capitalize(tinctures[1]!)}`;
  }
  return `Quarterly, first ${capitalize(tinctures[0]!)}, second ${capitalize(tinctures[1]!)}, third ${capitalize(tinctures[2]!)}, fourth ${capitalize(tinctures[3]!)}`;
}

const FIELD_BLAZON: Record<Division, (tinctures: string[]) => string> = {
  plain: (tinctures) => capitalize(tinctures[0] ?? ""),
  "per-pale": named("Per pale"),
  "per-fess": named("Per fess"),
  "per-bend": named("Per bend"),
  "per-bend-sinister": named("Per bend sinister"),
  quarterly: blazonQuarterly,
  gyronny: ofCount("Gyronny", "gyronny"),
  "per-saltire": named("Per saltire"),
  "per-chevron": named("Per chevron"),
  "tierced-in-pale": (tinctures) => `Tierced per pale ${listTinctures(tinctures)}`,
  "tierced-in-fess": (tinctures) => `Tierced per fess ${listTinctures(tinctures)}`,
  barry: ofCount("Barry", "barry"),
  paly: ofCount("Paly", "paly"),
  bendy: ofCount("Bendy", "bendy"),
  checky: named("Checky"),
  lozengy: named("Lozengy"),
  chevronny: ofCount("Chevronny", "chevronny"),
};

function blazonField(field: FieldConfig): string {
  const tinctures = field.tinctures.slice(0, DIVISION_SECTIONS_COUNT[field.division]);
  return tinctures.length === 0 ? "" : FIELD_BLAZON[field.division](tinctures);
}

function blazonOrdinary(ord: OrdinaryConfig): string {
  const lineStyleText = ord.lineStyle !== "straight" ? ` ${ord.lineStyle}` : "";
  const name = ord.type === "lozenge-ordinary" ? "lozenge" : ord.type.replace(/-/g, " ");
  return `a ${name}${lineStyleText} ${capitalize(ord.tincture)}`;
}

function blazonCharge(charge: ChargeRef): string {
  const countWord = numberToWord(charge.count);
  const nameText = pluralize(charge.chargeId, charge.count);
  const attitudeText = charge.attitude ? ` ${charge.attitude}` : "";
  const tinctureText = ` ${capitalize(charge.tincture)}`;

  return `${countWord} ${nameText}${attitudeText}${tinctureText}`;
}

function blazonExternals(externals: ExternalOrnaments): string {
  const parts: string[] = [];

  if (externals.motto) {
    parts.push(`Motto: "${externals.motto.text}" upon a scroll ${externals.motto.position}`);
  }

  return parts.join("; ");
}

export function generateBlazon(comp: HeraldryComposition): string {
  const fieldText = blazonField(comp.shield.field);
  let result = fieldText;

  // Ordinaries
  const ordinaries: string[] = [];
  if (comp.shield.ordinaries && comp.shield.ordinaries.length > 0) {
    comp.shield.ordinaries.forEach((ord) => {
      ordinaries.push(blazonOrdinary(ord));
    });
  }

  if (ordinaries.length > 0) {
    result += ", " + ordinaries.join(", ");
  }

  // Charges
  const charges: string[] = [];
  if (comp.shield.charges && comp.shield.charges.length > 0) {
    comp.shield.charges.forEach((charge) => {
      charges.push(blazonCharge(charge));
    });
  }

  if (charges.length > 0) {
    result += "; " + charges.join("; ");
  }

  // Externals
  if (comp.externals) {
    const extText = blazonExternals(comp.externals);
    if (extText) {
      result += "; " + extText;
    }
  }

  // Formatting: capitalize first word of the whole blazon
  return result ? result.charAt(0).toUpperCase() + result.slice(1) : "";
}
