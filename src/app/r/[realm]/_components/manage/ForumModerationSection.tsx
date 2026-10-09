import Link from "next/link";
import { Button } from "~/components/ui/button";
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
        <Link href={`/thinkpages/mod?realm=${encodeURIComponent(slug)}`}>
          Open the moderation console
        </Link>
      </Button>
    </ManageSection>
  );
}
