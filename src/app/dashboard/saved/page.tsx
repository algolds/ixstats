import { type Metadata } from "next";
import { SavedPosts } from "~/components/thinkpages/SavedPosts";
import { AuthenticationGuard } from "~/components/mycountry/shared/primitives";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export const metadata: Metadata = {
  title: "Saved posts - IxStates",
};

export default function SavedPostsPage() {
  return (
    <AuthenticationGuard>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Saved posts" />
      <SavedPosts />
    </AuthenticationGuard>
  );
}
