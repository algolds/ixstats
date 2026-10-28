"use client";

import "~/styles/wiki-os.css";
import { NavArrowLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { useLoreWriter, type LorePhase, type LoreWriterSeed } from "~/hooks/lore/useLoreWriter";
import { api } from "~/trpc/react";
import { LoreDetailsStep } from "./writer/LoreDetailsStep";
import { LoreEditorStep, LoreEditorTools } from "./writer/LoreEditorStep";
import { LoreRecordStep } from "./writer/LoreRecordStep";
import { LoreTypeStep } from "./writer/LoreTypeStep";

export interface LoreWriterProps {
  countryId: string;
  countryName: string;
  open: boolean;
  onClose: () => void;
  /** What an entry point already knows: the type, the title, a map place or a History entry's date. */
  seed?: LoreWriterSeed;
  /** Edit this existing piece: the editor opens on it straight away. */
  editTitle?: string;
}

const DESCRIPTIONS: Record<LorePhase, string> = {
  type: "Choose what the piece is about.",
  details: "Name the piece and fill in its infobox.",
  editor: "Write the piece. It is saved as a wiki page.",
  saved: "The page is saved; it is being added to the Lore tab.",
};

function OpenLoreWriter({ countryId, countryName, onClose, seed, editTitle }: LoreWriterProps) {
  const flow = useLoreWriter({ countryId, countryName, seed, editTitle, onClose });
  const isOwner = api.countryLore.access.useQuery({ countryId }).data?.isOwner ?? false;
  const inEditor = flow.phase === "editor" && flow.target !== null;
  return (
    <Dialog open onOpenChange={(next) => !next && flow.requestClose()}>
      <DialogContent
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0"
        // The editor's own menus (the slash menu, dialogs) use Escape: it never closes the writer while it is open.
        // Close, the editor's Cancel and Back are the ways out.
        onEscapeKeyDown={(event) => {
          if (flow.phase === "editor") event.preventDefault();
        }}
      >
        <div className="border-separator flex flex-wrap items-center gap-3 border-b px-4 py-3 pr-14">
          {inEditor && flow.target?.prefill !== undefined && (
            <Button size="sm" variant="ghost" onClick={flow.backToDetails}>
              <NavArrowLeft aria-hidden="true" />
              Back
            </Button>
          )}
          <DialogTitle className="text-title-3 min-w-0 flex-1 truncate">
            {editTitle ? `Edit ${editTitle}` : `Write lore for ${countryName}`}
          </DialogTitle>
          {inEditor && flow.target && (
            <LoreEditorTools
              title={flow.target.title}
              words={flow.words}
              onOpenInWikiOS={flow.handOverToWikiOS}
            />
          )}
        </div>
        <DialogDescription className="sr-only">{DESCRIPTIONS[flow.phase]}</DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {flow.phase === "type" && <LoreTypeStep value={flow.type} onContinue={flow.chooseType} />}
          {flow.phase === "details" && (
            <LoreDetailsStep
              type={flow.type ?? "other"}
              title={flow.title}
              onTitleChange={flow.setTitle}
              fields={flow.fields}
              onFieldsChange={flow.setFields}
              isOwner={isOwner}
              carried={flow.carried}
              onStartAgain={flow.startAgain}
              onBack={flow.backToType}
              onContinue={flow.startWriting}
              onAddExisting={flow.addExisting}
            />
          )}
          {flow.phase === "editor" && <LoreEditorStep flow={flow} />}
          {flow.phase === "saved" && (
            <LoreRecordStep
              record={flow.record}
              countryName={countryName}
              onRetry={flow.retryRecord}
              onEditAgain={flow.editAgain}
              onDone={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * LoreWriter: writing a native lore piece without leaving the country page
 * (docs/specs/2026-10-24-native-lore-design.md, "Writing flow"). A full-screen overlay: the piece's type,
 * its title (checked against the wiki) and infobox fields, then WikiOS's editor on the generated starting text, then
 * the Lore tab record. With `editTitle` it opens the editor on that piece. Each opening starts afresh.
 */
export function LoreWriter(props: LoreWriterProps) {
  if (!props.open) return null;
  return <OpenLoreWriter {...props} />;
}
