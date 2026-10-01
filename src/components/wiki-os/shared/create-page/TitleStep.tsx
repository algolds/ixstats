import React from "react";
import { ShieldAlert } from "iconoir-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
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
        <label htmlFor="wikios-create-title" className="text-subhead text-label-secondary">
          Page title
        </label>
        <Input
          id="wikios-create-title"
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setExistsWarning(false);
          }}
          placeholder="Enter article title..."
        />
        {existsWarning && (
          <div className="rounded-control bg-red/10 text-footnote text-red flex items-start gap-2 p-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Page already exists.</span> You can{" "}
              <button
                onClick={() => {
                  onClose();
                  router.push(
                    withBasePath(`/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`)
                  );
                }}
                className="text-tint font-medium underline"
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
                className="text-tint font-medium underline"
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
          <span className="text-subhead text-label-secondary block">Preferred editor</span>
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <Checkbox
              checked={rememberChoice}
              onCheckedChange={(checked) => onRememberChoiceChange(checked === true)}
            />
            <span className="text-footnote text-label-secondary">Remember choice</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={editorMode === "visual"}
            onClick={() => setEditorMode("visual")}
            className={cn(
              "rounded-row duration-fast flex flex-col items-start border p-3 text-left transition-colors",
              editorMode === "visual"
                ? "border-tint bg-tint-fill text-label"
                : "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3"
            )}
          >
            <span className="text-headline text-label">Canvas Editor</span>
            <span className="text-footnote text-label-secondary mt-0.5">
              Immersive editing experience
            </span>
          </button>
          <button
            type="button"
            aria-pressed={editorMode === "source"}
            onClick={() => setEditorMode("source")}
            className={cn(
              "rounded-row duration-fast flex flex-col items-start border p-3 text-left transition-colors",
              editorMode === "source"
                ? "border-tint bg-tint-fill text-label"
                : "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3"
            )}
          >
            <span className="text-headline text-label">Source Editor</span>
            <span className="text-footnote text-label-secondary mt-0.5">
              Old-school wikitext editing experience
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
