// src/app/(forum)/forum/layout.tsx
// Forum route group layout — imports forum CSS and wraps with ForumContextProvider.

import "~/styles/forum.css";
import { type Metadata } from "next";
import { ForumContextProvider } from "~/components/forum/shared/ForumContext";
import { ForumHalo } from "~/components/halo/plugins";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export const metadata: Metadata = {
  title: {
    template: "%s | IxForum",
    default: "IxForum | Community discussion",
  },
  description: "The IxForum community forum for Ixnay.",
  openGraph: {
    siteName: "IxForum",
    type: "website",
  },
};

export default function ForumRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ForumContextProvider>
      <ForumHalo />
      <div data-app="forum" className="forum-root min-h-screen">
        <PortalTintSync />
        {children}
      </div>
    </ForumContextProvider>
  );
}
