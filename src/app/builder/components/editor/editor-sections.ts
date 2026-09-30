import type { ComponentType, SVGProps } from "react";
import { WhiteFlag, City, StatUp, CheckCircle } from "iconoir-react";
import type { BuilderSection } from "../../lib/builder-theme";
import type { EditorSection } from "../../lib/edit-changes";

export interface EditorNavItem {
  section: Extract<BuilderSection, "identity" | "government" | "economics" | "preview">;
  /** Section whose saved fields this item edits; Review edits none. */
  changeSection: EditorSection | null;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** The country editor's sections, in order. Foundation and wiki import are creation-only. */
export const EDITOR_NAV: readonly EditorNavItem[] = [
  {
    section: "identity",
    changeSection: "identity",
    label: "Identity",
    description: "Name, symbols and headline figures",
    icon: WhiteFlag,
  },
  {
    section: "government",
    changeSection: "government",
    label: "Government",
    description: "Institutions, departments and budget",
    icon: City,
  },
  {
    section: "economics",
    changeSection: "economics",
    label: "Economy",
    description: "Sectors, labour, demographics and tax",
    icon: StatUp,
  },
  {
    section: "preview",
    changeSection: null,
    label: "Review",
    description: "What changed and the country at a glance",
    icon: CheckCircle,
  },
];

export const EDITOR_SECTION_LABELS: Record<EditorSection, string> = {
  identity: "Identity",
  government: "Government",
  economics: "Economy",
};

export function editorNavItem(section: BuilderSection): EditorNavItem | undefined {
  return EDITOR_NAV.find((item) => item.section === section);
}

/** "Saving…", "Saved at 10:42", … — the editor's autosave state in words. */
export type EditorSaveStatus = "saved" | "pending" | "saving" | "error";

export function describeSaveStatus(status: EditorSaveStatus, lastSyncedAt: Date | null): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "pending":
      return "Unsaved changes";
    case "error":
      return "Couldn't save your latest changes";
    case "saved":
      return lastSyncedAt
        ? `All changes saved at ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "All changes saved";
  }
}
