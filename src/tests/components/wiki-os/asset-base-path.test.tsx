/** @jest-environment node */
/**
 * Uploads are stored without the base path (`/images/uploads/…`). Under production's `/projects/ixstates` the
 * article hero (and its preload), a category tile's image and the flag banners must load from the app, not from
 * classic's root. Rendered on the server, as the first HTML is.
 */
import { renderToString } from "react-dom/server";

jest.mock("~/trpc/react", () => {
  const result = () => ({ data: undefined, isLoading: false, isPending: false, mutate: jest.fn() });
  const hooks = new Set(["useQuery", "useMutation", "useSuspenseQuery", "useInfiniteQuery"]);
  // Every router, procedure and util is this callable proxy; the hooks answer "no data yet".
  const deep: object = new Proxy(() => undefined, {
    get: (_target, key) => (hooks.has(String(key)) ? result : deep),
    apply: () => deep,
  });
  return { api: deep };
});
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => ({ isSignedIn: false }) }));

const BASE = "/projects/ixstates";
const UPLOAD = "/images/uploads/uploaded_1_abc_IMG.PNG";

let saved: string | undefined;
beforeAll(() => {
  saved = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
});
afterAll(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = saved;
});

const srcs = (html: string) => [...html.matchAll(/\ssrc="([^"]*)"/g)].map((m) => m[1]);

describe("uploaded assets under the base path", () => {
  it("the article hero and its preload use the base path for an uploaded flag", async () => {
    const { WikiOSHeader } = await import("~/components/wiki-os/reader/ArticleHeader");
    const html = renderToString(
      <WikiOSHeader title="Faneria" lastModified={null} countryData={{ flagUrl: UPLOAD }} />
    );
    expect(srcs(html)).toContain(`${BASE}${UPLOAD}`);
    expect(html).not.toMatch(/(?:src|href)="\/images\/uploads\//);
  });

  it("a lead image already under the base path is not doubled, and an absolute one is kept", async () => {
    const { WikiOSHeader } = await import("~/components/wiki-os/reader/ArticleHeader");
    const proxied = renderToString(
      <WikiOSHeader
        title="X"
        lastModified={null}
        featuredImageUrl={`${BASE}/api/mediawiki/ixwiki/images/0/07/F.svg`}
      />
    );
    expect(srcs(proxied)).toContain(`${BASE}/api/mediawiki/ixwiki/images/0/07/F.svg`);
    expect(proxied).not.toContain(`${BASE}${BASE}`);
    const absolute = renderToString(
      <WikiOSHeader
        title="X"
        lastModified={null}
        featuredImageUrl="https://ixwiki.com/images/0/07/F.svg"
      />
    );
    expect(srcs(absolute)).toContain("https://ixwiki.com/images/0/07/F.svg");
  });

  it("a category tile's flag and image use the base path", async () => {
    const { CategoryPageCard } = await import("~/components/wiki-os/categories/CategoryParts");
    expect(srcs(renderToString(<CategoryPageCard title="Faneria" flagUrl={UPLOAD} />))).toEqual([
      `${BASE}${UPLOAD}`,
    ]);
    expect(
      srcs(
        renderToString(
          <CategoryPageCard title="Faneria" imageUrl="/api/mediawiki/ixwiki/images/a/ab/F.png" />
        )
      )
    ).toEqual([`${BASE}/api/mediawiki/ixwiki/images/a/ab/F.png`]);
  });

  it("the flag banner and watermark use the base path", async () => {
    const { FlagBanner } = await import("~/components/mycountry/shell/headers/FlagBanner");
    const { FlagWatermark } = await import("~/components/ui/facet/identity/FlagWatermark");
    expect(srcs(renderToString(<FlagBanner src={UPLOAD} />))).toEqual([`${BASE}${UPLOAD}`]);
    expect(srcs(renderToString(<FlagWatermark src={UPLOAD} />))).toEqual([`${BASE}${UPLOAD}`]);
    expect(srcs(renderToString(<FlagBanner src="https://x.example/f.png" />))).toEqual([
      "https://x.example/f.png",
    ]);
  });
});
