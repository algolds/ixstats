import type { Metadata } from "next";
import { headers } from "next/headers";
import { withBasePath } from "~/lib/base-path";
import { isStandaloneRequest } from "~/lib/system/standalone-detection";
import { WikiHalo } from "~/components/halo/plugins";
import { MediaContextProvider } from "~/components/media/MediaContext";
import { MiniPlayer } from "~/components/media/MiniPlayer";
import { MediaThemeProvider } from "~/components/wiki-os/shared/MediaThemeContext";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export const metadata: Metadata = {
  title: "WikiOS | Worldbuilding encyclopedia",
  description: "Native encyclopedia, lore, and worldbuilding OS",
  icons: [
    { rel: "icon", url: withBasePath("/favicon-wikios.svg"), type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: withBasePath("/favicon-wikios.svg") },
  ],
};

/**
 * Media playback and image-theme state are wiki-only (article narrator, reader images), so they
 * mount here rather than in the root layout. Consumers outside WikiOS (Halo settings, /settings,
 * the map's image lightbox) use useWikiMediaTheme()'s standalone fallback, kept in sync via
 * localStorage + the media-theme event.
 */
export default async function WikiosLayout({ children }: { children: React.ReactNode }) {
  const isStandalone = isStandaloneRequest(await headers());

  return (
    <div data-app="wiki" className="contents">
      <PortalTintSync />
      <MediaContextProvider>
        <MediaThemeProvider>
          <WikiHalo />
          {children}
          {!isStandalone && <MiniPlayer />}
        </MediaThemeProvider>
      </MediaContextProvider>
    </div>
  );
}
