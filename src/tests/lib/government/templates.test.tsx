/**
 * Government policy presets: every template references only defined components, and
 * applying one sets the whole selection (spec §4; the old loop kept only the last pick).
 */

import { act, renderHook } from "@testing-library/react";
import type { ComponentType } from "@prisma/client";
import { useAtomicGovernmentBuilder } from "~/hooks/useAtomicGovernmentBuilder";
import {
  ATOMIC_COMPONENTS,
  GOVERNMENT_TEMPLATES,
  getTemplateSelection,
} from "~/lib/government/atomic-data";

const TEMPLATE_IDS = Object.keys(GOVERNMENT_TEMPLATES);

describe("GOVERNMENT_TEMPLATES", () => {
  it("references only defined components", () => {
    const ghosts = Object.entries(GOVERNMENT_TEMPLATES).flatMap(([id, template]) =>
      template.components.filter((type) => !ATOMIC_COMPONENTS[type]).map((type) => `${id}:${type}`)
    );
    expect(ghosts).toEqual([]);
  });

  it("defines the components templates used to reference without a definition", () => {
    expect(ATOMIC_COMPONENTS.PLANNED_ECONOMY).toBeDefined();
    expect(ATOMIC_COMPONENTS.INSTITUTIONAL_LEGITIMACY).toBeDefined();
  });

  it("returns the full component set for a template and nothing for an unknown id", () => {
    for (const id of TEMPLATE_IDS) {
      expect(getTemplateSelection(id)).toEqual([...new Set(GOVERNMENT_TEMPLATES[id]!.components)]);
    }
    expect(getTemplateSelection("not-a-template")).toEqual([]);
  });
});

describe("applying a template through useAtomicGovernmentBuilder", () => {
  it.each(TEMPLATE_IDS)("sets every component of %s in one update", (templateId) => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useAtomicGovernmentBuilder({
        initialComponents: ["MILITARY_ADMINISTRATION"],
        maxComponents: 15,
        onChange,
      })
    );

    act(() => {
      result.current.setSelection(getTemplateSelection(templateId));
    });

    const expected = [...GOVERNMENT_TEMPLATES[templateId]!.components];
    expect(result.current.selectedComponents).toEqual(expected);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("keeps undefined components out of the cap", () => {
    const defined = Object.keys(ATOMIC_COMPONENTS).slice(0, 15) as ComponentType[];
    const { result } = renderHook(() =>
      useAtomicGovernmentBuilder({
        initialComponents: ["NOT_A_COMPONENT" as ComponentType, ...defined.slice(0, 14)],
        maxComponents: 15,
      })
    );
    expect(result.current.canSelectMore).toBe(true);

    act(() => {
      result.current.selectComponent(defined[14]!);
    });
    expect(result.current.selectedComponents).toHaveLength(16);
    expect(result.current.canSelectMore).toBe(false);
    expect(result.current.validation.isValid).toBe(true);
  });
});
