"use client";

import { Fragment, type ComponentType, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ArrowUp as Superscript,
  ArrowDown as Subscript,
  List,
  NumberedListLeft as ListOrdered,
  Quote,
  Link as Link2,
  LinkSlash as Unlink,
  MediaImage as ImageIcon,
  Code,
  Minus,
  Type,
  Undo as Undo2,
  Redo as Redo2,
  Erase as RemoveFormatting,
  Table,
  ArrowRight as Indent,
  ArrowLeft as Outdent,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { useEditorModalContext } from "../context/EditorModalContext";
import { StashDropdown } from "./shared/StashDropdown";
import { TemplateDropdown } from "./shared/TemplateDropdown";
import { SettingsDropdown } from "./shared/SettingsDropdown";
import { WikiEditorHeader } from "./WikiEditorHeader";
import { Button } from "~/components/ui/button";

interface WikiVisualToolbarProps {
  title: string;
  wordCount: number;
  isDirty: boolean;
  repulsionProgress: number;
  onSwitchToSource?: () => void;
  onCancel: () => void;
  handleSaveDraft: () => void;
  activeFormats: Set<string>;
  exec: (cmd: string, val?: string) => void;
  setHeading: (level: number) => void;
  setParagraph: () => void;
  insertLink: () => void;
  removeLink: () => void;
  insertHR: () => void;
  insertTable: () => void;
  insertRef: () => void;
  clearFormatting: () => void;
  saveSelection?: () => void;
  restoreSelection?: () => void;
  handleInsertStashedImage: (filename: string) => void;
}

interface ToolbarButton {
  title: string;
  /** Icon component, or a short text label (headings, ref). */
  icon: ComponentType<{ className?: string }> | string;
  /** Lit while the selection has any of these formats. */
  formats?: string[];
  onClick: () => void;
}

export function WikiVisualToolbar({
  title,
  wordCount,
  isDirty,
  repulsionProgress,
  onSwitchToSource,
  onCancel,
  handleSaveDraft,
  activeFormats,
  exec,
  setHeading,
  setParagraph,
  insertLink,
  removeLink,
  insertHR,
  insertTable,
  insertRef,
  clearFormatting,
  saveSelection,
  restoreSelection,
  handleInsertStashedImage,
}: WikiVisualToolbarProps) {
  const modal = useEditorModalContext();

  const buttonGroups: Array<Array<ToolbarButton | ReactNode>> = [
    [
      { icon: Undo2, title: "Undo (Ctrl+Z)", onClick: () => exec("undo") },
      { icon: Redo2, title: "Redo (Ctrl+Y)", onClick: () => exec("redo") },
    ],
    [
      { icon: Bold, title: "Bold (Ctrl+B)", formats: ["bold"], onClick: () => exec("bold") },
      {
        icon: Italic,
        title: "Italic (Ctrl+I)",
        formats: ["italic"],
        onClick: () => exec("italic"),
      },
      {
        icon: Underline,
        title: "Underline (Ctrl+U)",
        formats: ["underline"],
        onClick: () => exec("underline"),
      },
      {
        icon: Strikethrough,
        title: "Strikethrough (Ctrl+Shift+X)",
        formats: ["strikethrough", "strike"],
        onClick: () => exec("strikeThrough"),
      },
    ],
    [
      {
        icon: Superscript,
        title: "Superscript",
        formats: ["superscript", "sup"],
        onClick: () => exec("superscript"),
      },
      {
        icon: Subscript,
        title: "Subscript",
        formats: ["subscript", "sub"],
        onClick: () => exec("subscript"),
      },
      {
        icon: Code,
        title: "Inline code",
        formats: ["code", "code-block"],
        onClick: () => exec("code"),
      },
    ],
    [
      { icon: Type, title: "Normal paragraph", formats: ["p", "paragraph"], onClick: setParagraph },
      { icon: "H2", title: "Section heading", formats: ["h2"], onClick: () => setHeading(2) },
      { icon: "H3", title: "Subsection", formats: ["h3"], onClick: () => setHeading(3) },
      { icon: "H4", title: "Sub-subsection", formats: ["h4"], onClick: () => setHeading(4) },
    ],
    [
      {
        icon: List,
        title: "Bullet list",
        formats: ["ul"],
        onClick: () => exec("insertUnorderedList"),
      },
      {
        icon: ListOrdered,
        title: "Numbered list",
        formats: ["ol"],
        onClick: () => exec("insertOrderedList"),
      },
      {
        icon: Quote,
        title: "Blockquote",
        formats: ["blockquote"],
        onClick: () => exec("formatBlock", "blockquote"),
      },
      { icon: Indent, title: "Indent", onClick: () => exec("indent") },
      { icon: Outdent, title: "Outdent", onClick: () => exec("outdent") },
    ],
    [
      { icon: Link2, title: "Insert link (Ctrl+K)", formats: ["link"], onClick: insertLink },
      { icon: Unlink, title: "Remove link", formats: ["link"], onClick: removeLink },
    ],
    [
      {
        icon: ImageIcon,
        title: "Insert image",
        onClick: () => {
          saveSelection?.();
          modal.setShowImageSearch(true);
        },
      },
      <StashDropdown
        key="stash"
        onInsertImage={(filename) => {
          restoreSelection?.();
          handleInsertStashedImage(filename);
        }}
        onBeforeOpen={saveSelection}
      />,
      { icon: Table, title: "Insert table", formats: ["table"], onClick: insertTable },
      <TemplateDropdown key="templates" onSelect={restoreSelection} onBeforeOpen={saveSelection} />,
      { icon: Minus, title: "Horizontal rule", onClick: insertHR },
      { icon: "ref", title: "Insert reference", onClick: insertRef },
    ],
    [{ icon: RemoveFormatting, title: "Clear formatting", onClick: clearFormatting }],
  ];

  return (
    <>
      <WikiEditorHeader
        title={title}
        mode="visual"
        wordCount={wordCount}
        isDirty={isDirty}
        repulsionProgress={repulsionProgress}
        onSwitchMode={onSwitchToSource}
        onCancel={onCancel}
        handleSaveDraft={handleSaveDraft}
        saving={modal.saving}
        saveDropdownOpen={modal.saveDropdownOpen}
        setSaveDropdownOpen={modal.setSaveDropdownOpen}
        setSaveActionType={modal.setSaveActionType}
        setShowSavePanel={modal.setShowSavePanel}
        summary={modal.summary}
        setSummary={modal.setSummary}
      />

      <div className="wikios-ve-toolbar">
        {buttonGroups.map((group, i) => (
          <Fragment key={i}>
            <div className="wikios-ve-toolbar-group">
              {group.map((item, j) =>
                isToolbarButton(item) ? (
                  <VEBtn
                    key={item.title}
                    icon={<ButtonIcon icon={item.icon} />}
                    title={item.title}
                    active={item.formats?.some((f) => activeFormats.has(f))}
                    onClick={item.onClick}
                  />
                ) : (
                  <Fragment key={j}>{item}</Fragment>
                )
              )}
            </div>
            {i < buttonGroups.length - 1 && <span className="wikios-ve-toolbar-sep" />}
          </Fragment>
        ))}

        {/* Far right: Editor Settings */}
        <div className="ml-auto flex items-center">
          <SettingsDropdown />
        </div>
      </div>
    </>
  );
}

const isToolbarButton = (item: ToolbarButton | ReactNode): item is ToolbarButton =>
  typeof item === "object" && item !== null && "title" in item && "onClick" in item;

function ButtonIcon({ icon: Icon }: { icon: ToolbarButton["icon"] }) {
  return typeof Icon === "string" ? (
    <span className="wikios-ve-heading-label">{Icon}</span>
  ) : (
    <Icon className="h-3.5 w-3.5" />
  );
}

function VEBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-pressed={active}
      // mousedown (not click) so the editor keeps its selection.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn("w-8", !active && "text-label-secondary")}
      title={title}
      aria-label={title}
    >
      {icon}
    </Button>
  );
}
