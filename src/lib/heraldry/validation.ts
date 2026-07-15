import type { HeraldryComposition, ValidationWarning } from "./types";
import { TINCTURE_KIND, DIVISION_SECTIONS_COUNT } from "./constants";

export function validateComposition(comp: HeraldryComposition): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const fieldTinctures = comp.shield.field.tinctures;

  // 1. Empty/Missing Division Tinctures
  const expectedCount = DIVISION_SECTIONS_COUNT[comp.shield.field.division] ?? 1;
  if (fieldTinctures.length === 0) {
    warnings.push({
      code: "empty-division",
      severity: "caution",
      message: `The field division '${comp.shield.field.division}' has no tinctures assigned.`,
      elementPath: "shield.field.tinctures",
    });
  } else if (fieldTinctures.length < expectedCount) {
    warnings.push({
      code: "incomplete-division",
      severity: "advisory",
      message: `The field division '${comp.shield.field.division}' expects ${expectedCount} tinctures but only got ${fieldTinctures.length}.`,
      elementPath: "shield.field.tinctures",
    });
  }

  // Helper to check rule of tincture conflict
  const hasRoTConflict = (itemTincture: string): boolean => {
    const itemKind = TINCTURE_KIND[itemTincture as import("./types").Tincture];
    if (!itemKind || itemKind === "fur") return false;

    // Check against all underlying field tinctures
    for (const fTinc of fieldTinctures) {
      const fKind = TINCTURE_KIND[fTinc as import("./types").Tincture];
      if (!fKind || fKind === "fur") continue;

      // Conflict: metal on metal or colour on colour (treat stains as colours)
      const isItemMetal = itemKind === "metal";
      const isFieldMetal = fKind === "metal";

      // If both are metals, or both are not metals (colours/stains)
      if (isItemMetal === isFieldMetal) {
        return true;
      }
    }
    return false;
  };

  // 2. Ordinaries checks
  if (comp.shield.ordinaries) {
    comp.shield.ordinaries.forEach((ord, index) => {
      if (hasRoTConflict(ord.tincture)) {
        warnings.push({
          code: "rule-of-tincture",
          severity: "advisory",
          message: `Rule of Tincture: Ordinary '${ord.type}' (${ord.tincture}) placed on conflicting field tincture.`,
          elementPath: `shield.ordinaries[${index}]`,
        });
      }
    });
  }

  // 3. Charges checks
  if (comp.shield.charges) {
    comp.shield.charges.forEach((charge, index) => {
      // Scale check
      if (charge.size < 0.1) {
        warnings.push({
          code: "scale-too-small",
          severity: "caution",
          message: `Charge size (${charge.size}) is too small to render clearly (minimum 0.1).`,
          elementPath: `shield.charges[${index}].size`,
        });
      }

      // Rule of Tincture
      if (hasRoTConflict(charge.tincture)) {
        warnings.push({
          code: "rule-of-tincture",
          severity: "advisory",
          message: `Rule of Tincture: Charge '${charge.chargeId}' (${charge.tincture}) placed on conflicting field tincture.`,
          elementPath: `shield.charges[${index}]`,
        });
      }
    });
  }

  return warnings;
}
