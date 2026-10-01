import React from "react";
import { ShieldAlert } from "iconoir-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { withBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";

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
      <div className="space-y-2">
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
          <div className="rounded-control bg-red/10 text-footnote text-red flex items-start gap-2 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Page already exists.</span> You can{" "}
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onClose();
                  router.push(
                    withBasePath(`/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`)
                  );
                }}
                className="h-auto px-0 align-baseline underline"
              >
                view
              </Button>{" "}
              or{" "}
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onClose();
                  router.push(
                    withBasePath(
                      `/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}/edit`
                    )
                  );
                }}
                className="h-auto px-0 align-baseline underline"
              >
                edit
              </Button>{" "}
              it instead.
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-subhead text-label-secondary block">Preferred editor</span>
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <Checkbox
              checked={rememberChoice}
              onCheckedChange={(checked) => onRememberChoiceChange(checked === true)}
            />
            <span className="text-footnote text-label-secondary">Remember choice</span>
          </label>
        </div>
        <RadioCardGroup
          aria-label="Preferred editor"
          value={editorMode}
          onValueChange={(v) => setEditorMode(v as "visual" | "source")}
          className="grid grid-cols-2 gap-3"
        >
          <RadioCard
            value="visual"
            title="Canvas Editor"
            description="Immersive editing experience"
          />
          <RadioCard
            value="source"
            title="Source Editor"
            description="Old-school wikitext editing experience"
          />
        </RadioCardGroup>
      </div>
    </div>
  );
}
