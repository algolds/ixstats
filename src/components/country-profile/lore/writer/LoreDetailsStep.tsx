"use client";

import { useState } from "react";
import Link from "next/link";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useLoreTitleCheck, type LoreTitleCheck } from "~/hooks/lore/useLoreTitleCheck";
import type { LoreType } from "~/lib/lore/lore-types";
import { wikiReaderPath } from "~/lib/wiki-os/config";
import type { LoreFields } from "~/lib/lore/lore-prefill";
import { LoreFieldsForm } from "./LoreFieldsForm";

const TITLE_ID = "lore-writer-title";
const STATUS_ID = "lore-writer-title-status";

const STATUS_LINES: Partial<Record<LoreTitleCheck["status"], string>> = {
  invalid: "Use an article title, with no namespace such as User: and none of # < > [ ] { } |.",
  checking: "Checking the title",
  failed: "The title could not be checked. Try again in a moment.",
  free: "This title is free.",
};

/** A page with the typed title exists: the owner may add it to the Lore tab as it is; nobody overwrites it. */
function ExistingPage({
  resolvedTitle,
  isOwner,
  onAddExisting,
}: {
  resolvedTitle: string;
  isOwner: boolean;
  onAddExisting: (title: string) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const add = async () => {
    setAdding(true);
    setFailure(null);
    const message = await onAddExisting(resolvedTitle);
    setFailure(message);
    setAdding(message === null);
  };
  return (
    <div className="rounded-row border-separator bg-surface space-y-2 border p-3">
      <p className="text-callout text-label">A page with this title exists.</p>
      <p className="text-footnote text-label-secondary">
        {isOwner
          ? "Add it to the Lore tab as it is, or choose another title for a new piece."
          : "Choose another title for a new piece. The country's owner can add this page to the Lore tab."}
      </p>
      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <Button size="sm" disabled={adding} onClick={() => void add()}>
            Add it to the Lore tab
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href={wikiReaderPath(resolvedTitle)}>View the page</Link>
        </Button>
      </div>
      {failure && (
        <p role="alert" className="text-footnote text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}

interface LoreDetailsStepProps {
  type: LoreType;
  title: string;
  onTitleChange: (title: string) => void;
  fields: LoreFields;
  onFieldsChange: (fields: LoreFields) => void;
  isOwner: boolean;
  /** The author's text from the editor is kept and will open again instead of the form's. */
  carried: boolean;
  onStartAgain: () => void;
  onBack: () => void;
  onContinue: (title: string) => void;
  /** Add the existing page; the failure to show, or null once added. */
  onAddExisting: (title: string) => Promise<string | null>;
}

/** The lore writer's second step: the piece's title, checked live, and its type's infobox fields. */
export function LoreDetailsStep(props: LoreDetailsStepProps) {
  const check = useLoreTitleCheck(props.title);
  const line = STATUS_LINES[check.status];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <label htmlFor={TITLE_ID} className="text-subhead text-label-secondary">
          Title
        </label>
        <Input
          id={TITLE_ID}
          value={props.title}
          aria-describedby={STATUS_ID}
          placeholder="e.g. Senate of Caphiria"
          onChange={(event) => props.onTitleChange(event.target.value)}
        />
        <div id={STATUS_ID} aria-live="polite" className="text-footnote text-label-secondary">
          {line && <p>{line}</p>}
          {check.status === "exists" && (
            <ExistingPage
              resolvedTitle={check.resolvedTitle}
              isOwner={props.isOwner}
              onAddExisting={props.onAddExisting}
            />
          )}
        </div>
      </div>
      {props.carried && (
        <div className="rounded-row border-separator bg-surface space-y-2 border p-3">
          <p className="text-footnote text-label">
            Your text from the editor is kept and opens again. Changes here will not change it.
          </p>
          <Button size="sm" variant="outline" onClick={props.onStartAgain}>
            Start again from the form
          </Button>
        </div>
      )}
      <LoreFieldsForm type={props.type} fields={props.fields} onChange={props.onFieldsChange} />
      <div className="border-separator flex justify-between border-t pt-4">
        <Button size="sm" variant="ghost" onClick={props.onBack}>
          <NavArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button
          size="sm"
          disabled={check.status !== "free"}
          onClick={() => check.status === "free" && props.onContinue(check.title)}
        >
          Open the editor
          <NavArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
