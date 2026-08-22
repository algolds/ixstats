import type { Metadata } from "next";
import { withBasePath } from "~/lib/base-path";
import { WikiHalo } from "~/components/halo/plugins";

export const metadata: Metadata = {
  title: "WikiOS — Worldbuilding Encyclopedia",
  description: "Native encyclopedia, lore, and worldbuilding OS",
  icons: [
    { rel: "icon", url: withBasePath("/favicon-wikios.svg"), type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: withBasePath("/favicon-wikios.svg") },
  ],
};

export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WikiHalo />
      {children}
    </>
  );
}
