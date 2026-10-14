/**
 * Stand-ins for the forum's Canvas composers in page-level tests, which test the wiring (what a page sends, where it
 * goes next), not the editor. Use as `jest.mock("~/components/thinkpages-forum/composer", () => composerStub())`.
 */
import React from "react";

interface Meta {
  personaId: string | null;
  title: string;
}
type Submit = (wikitext: string, meta: Meta) => Promise<{ formatting: "done" | "pending" }>;

export const STUB_WIKITEXT = "New ''text''";

function SubmitButton({ label, onSubmit }: { label: string; onSubmit: Submit }) {
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void onSubmit(STUB_WIKITEXT, { personaId: null, title: "Hello" }).catch((e: Error) =>
            setError(e.message)
          )
        }
      >
        {label}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

const LABEL = { reply: "Reply", thread: "Post", edit: "Save" } as const;

export function composerStub() {
  const constants = jest.requireActual<{ PHONE_QUERY: string; REPLY_ID: string }>(
    "~/components/thinkpages-forum/composer/constants"
  );
  const quote = jest.requireActual<object>("~/components/thinkpages-forum/composer/QuoteInsert");
  return {
    ...constants,
    ...quote,
    useMyPersonas: () => [],
    CanvasComposer: ({
      mode,
      initialWikitext,
      onSubmit,
    }: {
      mode: keyof typeof LABEL;
      initialWikitext?: string;
      onSubmit: Submit;
    }) => (
      <div data-testid="canvas-composer" data-mode={mode} data-initial={initialWikitext ?? ""}>
        <SubmitButton label={LABEL[mode]} onSubmit={onSubmit} />
      </div>
    ),
    ReplyComposer: ({
      onSubmit,
      quoteRequest,
      phone,
      open,
      onOpenChange,
    }: {
      onSubmit: Submit;
      quoteRequest?: { postId: string } | null;
      phone: boolean;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <section id={constants.REPLY_ID} aria-label="Reply">
        {phone ? (
          <button type="button" data-testid="reply-dock" onClick={() => onOpenChange(true)}>
            Reply bar
          </button>
        ) : null}
        {!phone || open ? (
          <div
            data-testid="composer"
            data-quote={quoteRequest?.postId ?? ""}
            contentEditable
            suppressContentEditableWarning
          >
            <SubmitButton label="Reply" onSubmit={onSubmit} />
          </div>
        ) : null}
      </section>
    ),
  };
}
