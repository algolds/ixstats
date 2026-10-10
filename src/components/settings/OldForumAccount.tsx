import { ChatBubble } from "iconoir-react";

interface OldForumStatus {
  linked: boolean;
  username: string | null;
}

/** The old XenForo account, as read-only text (phase 4b: linking is retired). */
export function oldForumAccountText(forum: OldForumStatus): string {
  if (!forum.linked) return "No old-forum account";
  return forum.username ? `Imported as ${forum.username}` : "Imported";
}

/**
 * The old forum account in Settings: who the imported posts are attributed to. Read-only, because attributing an
 * old account is a staff action in the admin users panel, not a self-service link.
 */
export function OldForumAccount({ forum }: { forum: OldForumStatus }) {
  return (
    <div className="rounded-row border-separator bg-surface-secondary flex items-start gap-4 border p-4">
      <div className="bg-fill-3 text-label-secondary rounded-control-sm flex size-7 shrink-0 items-center justify-center">
        <ChatBubble aria-hidden className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-headline text-label">Old forum</div>
        <p className="text-footnote text-label-secondary mt-0.5">{oldForumAccountText(forum)}</p>
        {!forum.linked && (
          <p className="text-footnote text-label-secondary mt-0.5">
            Posts from the old forum are attributed by staff. Ask them if some of them are yours.
          </p>
        )}
      </div>
    </div>
  );
}
