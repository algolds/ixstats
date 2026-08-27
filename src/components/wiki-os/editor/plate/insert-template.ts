/**
 * insert-template.ts — Adapter for inserting a master template preset as an
 * atomic Plate node. Consumed by the slash menu and (when mounted) the
 * Template Palette's "Insert into Canvas" action.
 */

import { Transforms, type Descendant, type BaseEditor } from "slate";
import { nanoid } from "platejs";
import type { MasterTemplatePreset } from "~/lib/wiki-os/templates/master-presets";

export function templatePresetToNode(preset: MasterTemplatePreset): Record<string, unknown> {
  const params = Object.fromEntries(
    (preset.variants?.[0]?.defaultFields ?? preset.params.slice(0, 4).map((p) => p.name)).map(
      (f) => [f, ""]
    )
  );
  return {
    type: "raw-html",
    id: nanoid(),
    kind: /infobox/i.test(preset.name) ? "infobox" : "generic",
    name: preset.name,
    params,
    html: `<div typeof="mw:Transclusion" class="wikios-ve-template"><em>${preset.description}</em></div>`,
    children: [{ text: "" }],
  };
}

/** Insert a template preset at the editor's current selection. */
export function insertTemplatePreset(
  editor: BaseEditor & Record<string, any>,
  preset: MasterTemplatePreset
): void {
  Transforms.insertNodes(editor, templatePresetToNode(preset) as unknown as Descendant);
  Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as unknown as Descendant);
}
