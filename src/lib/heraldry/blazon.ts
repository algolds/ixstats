import type {
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

function blazonField(field: FieldConfig): string {
  const division = field.division;
  const tinctures = field.tinctures;

  if (division === "plain" || tinctures.length === 0) {
    return capitalize(tinctures[0] ?? "");
  }

  if (division === "per-pale" && tinctures.length >= 2) {
    return `Per pale ${capitalize(tinctures[0]!)} and ${capitalize(tinctures[1]!)}`;
  }
  if (division === "per-fess" && tinctures.length >= 2) {
    return `Per fess ${capitalize(tinctures[0]!)} and ${capitalize(tinctures[1]!)}`;
  }
  if (division === "per-bend" && tinctures.length >= 2) {
    return `Per bend ${capitalize(tinctures[0]!)} and ${capitalize(tinctures[1]!)}`;
  }
  if (division === "per-bend-sinister" && tinctures.length >= 2) {
    return `Per bend sinister ${capitalize(tinctures[0]!)} and ${capitalize(tinctures[1]!)}`;
  }

  if (division === "quarterly" && tinctures.length >= 4) {
    if (tinctures[0] === tinctures[3] && tinctures[1] === tinctures[2]) {
      return `Quarterly, first and fourth ${capitalize(tinctures[0]!)}, second and third ${capitalize(tinctures[1]!)}`;
    }
    return `Quarterly, first ${capitalize(tinctures[0]!)}, second ${capitalize(tinctures[1]!)}, third ${capitalize(tinctures[2]!)}, fourth ${capitalize(tinctures[3]!)}`;
  }

  // Fallback
  const divName = division.replace(/-/g, " ");
  return `${capitalize(divName)} ${tinctures.map(capitalize).join(" and ")}`;
}

function blazonOrdinary(ord: OrdinaryConfig): string {
  const lineStyleText = ord.lineStyle !== "straight" ? ` ${ord.lineStyle}` : "";
  return `a ${ord.type}${lineStyleText} ${capitalize(ord.tincture)}`;
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
