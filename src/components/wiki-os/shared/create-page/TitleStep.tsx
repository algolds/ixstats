import React from "react";
import {
  ShieldAlert,
  // oxlint-disable-next-line eslint/no-unused-vars
  Xmark as X,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";

interface TitleStepProps {
  title: string;
  setTitle: (title: string) => void;
  editorMode: "visual" | "source";
  setEditorMode: (mode: "visual" | "source") => void;
  existsWarning: boolean;
  setExistsWarning: (val: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  rememberChoice: boolean;
  onRememberChoiceChange: (checked: boolean) => void;
}

export function TitleStep({
  title,
  setTitle,
  editorMode,
  setEditorMode,
  existsWarning,
  setExistsWarning,
  inputRef,
  onClose,
  rememberChoice,
  onRememberChoiceChange,
}: TitleStepProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium tracking-wider text-[var(--wikios-text-muted)] uppercase">
          Page Title
        </label>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setExistsWarning(false);
          }}
          placeholder="Enter article title..."
          className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-4 py-2.5 text-sm text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
        />
        {existsWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--wikios-red)]/20 bg-[var(--wikios-red)]/10 p-2.5 text-xs text-[var(--wikios-red)]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Page already exists!</span> You can{" "}
              <button
                onClick={() => {
                  onClose();
                  router.push(
                    withBasePath(`/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`)
                  );
                }}
                className="font-medium text-[var(--wikios-text)] underline hover:text-[var(--wikios-accent)]"
              >
                view
              </button>{" "}
              or{" "}
              <button
                onClick={() => {
                  onClose();
                  router.push(
                    withBasePath(
                      `/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}/edit`
                    )
                  );
                }}
                className="font-medium text-[var(--wikios-text)] underline hover:text-[var(--wikios-accent)]"
              >
                edit
              </button>{" "}
              it instead.
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium tracking-wider text-[var(--wikios-text-muted)] uppercase">
            Preferred Editor
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => onRememberChoiceChange(e.target.checked)}
              className="bg-foreground/[0.05] h-3 w-3 cursor-pointer rounded border-[var(--wikios-border)] text-[var(--wikios-accent)] focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[10px] text-[var(--wikios-text-dim)] transition-colors hover:text-[var(--wikios-text-muted)]">
              Remember choice
            </span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEditorMode("visual")}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
              editorMode === "visual"
                ? "border-[var(--wikios-accent)] bg-[var(--wikios-accent)]/[0.08] text-[var(--wikios-text)] shadow-[0_0_12px_var(--wikios-accent)]/15"
                : "bg-foreground/[0.03] hover:bg-foreground/[0.06] border-[var(--wikios-border)] text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
            )}
          >
            <span className="text-xs font-semibold text-[var(--wikios-text)]">Canvas Editor</span>
            <span className="mt-0.5 text-[10px] text-[var(--wikios-text-dim)]">
              Immersive editing experience
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode("source")}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
              editorMode === "source"
                ? "border-[var(--wikios-accent)] bg-[var(--wikios-accent)]/[0.08] text-[var(--wikios-text)] shadow-[0_0_12px_var(--wikios-accent)]/15"
                : "bg-foreground/[0.03] hover:bg-foreground/[0.06] border-[var(--wikios-border)] text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
            )}
          >
            <span className="text-xs font-semibold text-[var(--wikios-text)]">Source Editor</span>
            <span className="mt-0.5 text-[10px] text-[var(--wikios-text-dim)]">
              Old-school wikitext editing experience
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
