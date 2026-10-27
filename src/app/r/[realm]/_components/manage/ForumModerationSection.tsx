import Link from "next/link";
import { Button } from "~/components/ui/button";
import { modHref } from "~/lib/thinkpages-forum/links";
import { ManageSection } from "./ManageSection";

/** Forum moderation: the board power moderates the realm's forum section, from the moderation console. */
export function ForumModerationSection({ slug }: { slug: string }) {
  return (
    <ManageSection
      id="board"
      title="Forum moderation"
      description="Hide, lock, warn and ban in this realm's forum section from the moderation console."
    >
      <Button asChild size="sm">
        <Link href={modHref({ realm: slug })}>Open the moderation console</Link>
      </Button>
    </ManageSection>
  );
}
