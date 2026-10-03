import { isKeyboardInputTarget } from "../hooks/drag-utils";
import type { MapEditorPlugin, ToolbarItem } from "./types";

/** A keydown handler that activates a toolbar item's mode when its shortcut key is pressed. */
export function toolShortcuts(
  items: ToolbarItem[],
  { skipInBorderEdit = false } = {}
): NonNullable<MapEditorPlugin["onKeyDown"]> {
  const modeByKey = new Map(items.map((item) => [item.shortcut.toLowerCase(), item.mode]));
  return (e, context) => {
    if (isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement)) {
      return false;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    // The border editor owns its own letters (e.g. P for vertex edit).
    if (skipInBorderEdit && context.state.activeEditorMode === "border_edit") return false;

    const mode = modeByKey.get(e.key.toLowerCase());
    if (!mode) return false;
    context.onModeChange(mode);
    return true;
  };
}
