import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { withBasePath } from "~/lib/base-path";
import { isStandaloneRequest } from "~/lib/system/standalone-detection";
import { WikiHalo } from "~/components/halo/plugins";
import { MediaContextProvider } from "~/components/media/MediaContext";
import { MiniPlayer } from "~/components/media/MiniPlayer";
import { MediaThemeProvider } from "~/components/wiki-os/shared/MediaThemeContext";

/**
 * The brand font of the footer and the editorial masthead (`--wikios-font-brand`), self-hosted from
 * public/fonts: one variable file, fetched only when a page actually sets text in it (no preload),
 * with a size-adjusted fallback so its arrival moves nothing.
 */
const hostGrotesk = localFont({
  src: "../../../public/fonts/HostGrotesk/HostGrotesk[wght].ttf",
  weight: "300 800",
  style: "normal",
  variable: "--font-host-grotesk",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "WikiOS — Worldbuilding Encyclopedia",
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
    <MediaContextProvider>
      <MediaThemeProvider>
        <div className={hostGrotesk.variable}>
          <WikiHalo />
          {children}
          {!isStandalone && <MiniPlayer />}
        </div>
      </MediaThemeProvider>
    </MediaContextProvider>
  );
}
