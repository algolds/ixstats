/**
 * Plan 413 (item 5): what a reader does not need at first paint is its own chunk, and the Iconoir
 * namespace is not imported by a runtime key.
 */
import { renderHook } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveChatBadgeIcon } from "~/components/ui/chat-badge-icon";
import { useMountOnFirstOpen } from "~/components/wiki-os/shared/useMountOnFirstOpen";
import { resolveNamedDepartmentIcon } from "~/components/mycountry/domains/government/atoms/department/department-constants";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

/** `name` is loaded with next/dynamic from `module`, and no static import brings it in. */
function expectDynamic(file: string, name: string, module: string) {
  const source = read(file);
  expect(source).toMatch(new RegExp(`const ${name} = dynamic\\(`));
  expect(source).toContain(`import("${module}")`);
  expect(source).not.toMatch(new RegExp(`^import\\s[^;]*\\b${name}\\b[^;]*from`, "m"));
}

describe("one chunk each", () => {
  it("the Main Page is not part of the article reader's page", () => {
    expectDynamic(
      "src/app/(wiki-os)/wiki/[...slug]/ArticlePageClient.tsx",
      "WikiOSMainPage",
      "~/components/wiki-os/reader/WikiOSMainPage"
    );
  });

  it("the search and create-page dialogs are fetched when first opened", () => {
    const file = "src/components/wiki-os/shared/WikiOSLayout.tsx";
    expectDynamic(file, "SearchModal", "./SearchModal");
    expectDynamic(file, "CreatePageModal", "./CreatePageModal");
    expect(read(file)).toContain("useMountOnFirstOpen(searchOpen)");
  });

  it("the full-screen player is fetched when first opened", () => {
    expectDynamic("src/components/media/MiniPlayer.tsx", "FullPlayer", "./FullPlayer");
  });

  it("the margin suite, TOC drawer, lightbox modal and stash manager are separate chunks", () => {
    const renderer = "src/components/wiki-os/reader/ArticleRenderer.tsx";
    expectDynamic(renderer, "WikiMarginDrawer", "~/components/wiki-os/margin/WikiMarginDrawer");
    expectDynamic(renderer, "SelectionCapsule", "~/components/wiki-os/margin/SelectionCapsule");
    expectDynamic(renderer, "MarginGutterPins", "~/components/wiki-os/margin/MarginGutterPins");
    expectDynamic(
      renderer,
      "MarginShareModal",
      "~/components/wiki-os/margin/modals/MarginShareModal"
    );
    expectDynamic(
      renderer,
      "AppleBooksTocDrawer",
      "~/components/wiki-os/reader/AppleBooksTocDrawer"
    );
    expect(read(renderer)).not.toContain('from "~/components/wiki-os/margin"');
    expectDynamic(
      "src/components/wiki-os/reader/ImageLightbox.tsx",
      "ImageLightboxModal",
      "./ImageLightboxModal"
    );
    expectDynamic(
      "src/components/wiki-os/reader/StashButton.tsx",
      "StashManagerModal",
      "./StashManagerModal"
    );
  });

  it("the layout imports WikiHalo from its own module, not the plugin barrel that pulls every plugin", () => {
    const layout = read("src/app/(wiki-os)/layout.tsx");
    expect(layout).toContain('import { WikiHalo } from "~/components/halo/plugins/wiki/WikiHalo";');
    expect(layout).not.toContain('from "~/components/halo/plugins"');
  });
});

describe("Iconoir", () => {
  it("is imported by name everywhere in src/components: no namespace import indexed by a runtime string", () => {
    const offenders = sourceFiles("src/components").filter((file) =>
      /import \* as \w+ from "iconoir-react"/.test(read(file))
    );
    expect(offenders).toEqual([]);
  });

  it("resolves a chat badge icon by name and falls back to the crown", () => {
    const crown = resolveChatBadgeIcon("Crown");
    expect(resolveChatBadgeIcon("Trophy")).not.toBe(crown);
    expect(resolveChatBadgeIcon("NoSuchIcon")).toBe(crown);
    expect(resolveChatBadgeIcon("")).toBe(crown);
    expect(resolveChatBadgeIcon(undefined)).toBe(crown);
    // an inherited property name is not an icon
    expect(resolveChatBadgeIcon("constructor")).toBe(crown);
  });

  it("resolves a department's named icon, never an image source or an unknown name", () => {
    expect(resolveNamedDepartmentIcon("Shield")).toBeTruthy();
    expect(resolveNamedDepartmentIcon("DeliveryTruck")).toBeTruthy();
    // the names the builder's government step stores
    for (const stored of ["Coins", "Activity", "Crown"]) {
      expect(resolveNamedDepartmentIcon(stored)).toBeTruthy();
    }
    expect(resolveNamedDepartmentIcon("https://example.com/a.png")).toBeNull();
    expect(resolveNamedDepartmentIcon("NoSuchIcon")).toBeNull();
    expect(resolveNamedDepartmentIcon(undefined)).toBeNull();
  });
});

describe("useMountOnFirstOpen", () => {
  it("is false until the first open and stays true after it closes", () => {
    const { result, rerender } = renderHook(({ open }) => useMountOnFirstOpen(open), {
      initialProps: { open: false },
    });
    expect(result.current).toBe(false);

    rerender({ open: true });
    expect(result.current).toBe(true);

    rerender({ open: false });
    expect(result.current).toBe(true);
  });

  it("is true at once for something that starts open", () => {
    const { result } = renderHook(() => useMountOnFirstOpen(true));
    expect(result.current).toBe(true);
  });
});
