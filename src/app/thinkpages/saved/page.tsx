import { SavedPosts } from "~/components/thinkpages/SavedPosts";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export default function SavedPostsPage() {
  return (
    <>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Saved posts" />
      <SavedPosts />
    </>
  );
}
