// src/app/(forum)/forum/layout.tsx
// Forum route group layout — imports forum CSS and wraps with ForumContextProvider.

import "~/styles/forum.css";
import { type Metadata } from "next";
import { ForumContextProvider } from "~/components/forum/shared/ForumContext";
import { ForumDIPlugin } from "~/components/DynamicIsland/plugins/ForumDIPlugin";


export const metadata: Metadata = {
  title: {
    template: "%s — IxForum",
    default: "IxForum — Community Discussion",
  },
  description: "IxForum — the native forum experience for the Ixnay community",
  openGraph: {
    siteName: "IxForum",
    type: "website",
  },
};

export default function ForumRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForumContextProvider>
      <ForumDIPlugin />
      <div className="forum-root min-h-screen">{children}</div>
    </ForumContextProvider>
  );
}
