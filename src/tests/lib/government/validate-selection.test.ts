/**
 * Government picker validation (spec §1 Step 3, D7): conflicts warn, an empty selection is
 * fine, and only defined components count toward the cap.
 */

import type { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { countDefinedComponents, validateSelection } from "~/lib/government/atomic-utils";

const DEFINED = Object.keys(ATOMIC_COMPONENTS) as ComponentType[];

describe("validateSelection (government)", () => {
  it("errors only when defined components exceed the cap", () => {
    const fifteen = DEFINED.slice(0, 15);
    expect(validateSelection(fifteen, 15).isValid).toBe(true);
    expect(validateSelection(DEFINED.slice(0, 16), 15).errors).toEqual([
      "Maximum 15 components allowed",
    ]);
  });

  it("does not count undefined components toward the cap", () => {
    const withGhost = [...DEFINED.slice(0, 15), "NOT_A_COMPONENT" as ComponentType];
    expect(countDefinedComponents(withGhost)).toBe(15);
    expect(validateSelection(withGhost, 15).isValid).toBe(true);
  });
});
