/**
 * World Studio and the admin map tools, where they write: a preset's draft is saved without the seed and published only
 * after asking; nothing is written while the presets are the built-ins from code, and the Studio's saved recipe is not
 * overwritten by them either. Applying to Ixnay takes only the ticked layers the world in view has, and is held while
 * the realm's lock can't be read. The admin layout still refuses a member on the bare Studio route; the Atlas Jobs tab
 * offers only the actions a job allows and asks before cancelling or rolling back; a realm's map pipeline config
 * round-trips unchanged and is held back with its bad art rows named.
 *
 * Folds: src/tests/components/maps/studio/studio-presets.test.tsx, src/tests/components/maps/studio/studio-shell.test.tsx,
 * src/tests/components/maps/studio/studio-ship.test.tsx, src/tests/hooks/use-studio-recipe.test.tsx,
 * src/tests/app/admin/studio-route.test.tsx, src/tests/app/admin/atlas/atlas-jobs-tab.test.tsx,
 * src/tests/app/admin/map-pipeline-draft.test.ts
 */
import { TextDecoder, TextEncoder } from "util";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

/** Which fake tRPC the component under test reads: the Studio's tabs, or the Atlas admin UI. */
const mockTrpc: { use: "studio" | "atlas" } = { use: "studio" };
jest.mock("~/trpc/react", () => {
  const studio = jest.requireActual("~/tests/helpers/fake-studio-trpc");
  const atlas = jest.requireActual("~/tests/helpers/fake-atlas-ui");
  return {
    api: new Proxy(
      {},
      { get: (_target, key) => (mockTrpc.use === "atlas" ? atlas.api : studio.api)[key] }
    ),
  };
});
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));
// The admin layout's and the Jobs tab's surroundings
let mockRole = "admin";
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/maps/studio",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "u", publicMetadata: { role: mockRole } }, isLoaded: true }),
  useAuth: () => ({ signOut: jest.fn() }),
  SignInButton: () => null,
}));
jest.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ user: { role: { name: mockRole } }, isLoading: false }),
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/components/providers/PortalTintSync", () => ({ PortalTintSync: () => null }));
jest.mock("~/app/admin/_components/SystemStatusWidget", () => ({
  SystemStatusStrip: () => <div data-testid="status-strip" />,
}));
jest.mock("~/app/admin/_components/AdminNavigationContext", () => ({
  AdminNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => jest.requireActual("~/tests/helpers/fake-atlas-ui").notify,
}));
jest.mock("~/components/ui/sheet", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    SheetContent: passthrough,
    SheetHeader: passthrough,
    SheetTitle: passthrough,
    SheetDescription: passthrough,
  };
});

import AdminLayout from "~/app/admin/layout";
import { AtlasJobsTab } from "~/app/admin/maps/_components/atlas/AtlasJobsTab";
import {
  draftPipeline,
  stableJson,
  toDraft,
  validateDraft,
} from "~/app/admin/realms/_components/map-pipeline/pipeline-draft";
import type { StudioContextValue } from "~/components/maps/studio/StudioContext";
import { StudioPresetsTab } from "~/components/maps/studio/StudioPresetsTab";
import { StudioShipTab } from "~/components/maps/studio/StudioShipTab";
import { useStudioRecipe } from "~/hooks/useStudioRecipe";
import { sourcePreset } from "~/lib/realms/sources/presets";
import { paramsForPreset, type StudioParams } from "~/lib/worldgen/studio-fields";
import { FACTORY_STUDIO_PRESETS, type StudioPreset } from "~/lib/worldgen/studio-presets";
import { saveStudioRecipe, studioRecipeKey } from "~/lib/worldgen/studio-recipe";
import {
  calls as atlasCalls,
  jobRow,
  realmRow,
  resetFakeAtlas,
  responses,
  state,
} from "~/tests/helpers/fake-atlas-ui";
import { setJob, start } from "~/tests/helpers/fake-map-import";
import {
  applyStatusQuery,
  presetWrites,
  resetStudioTrpc,
  versionsQuery,
} from "~/tests/helpers/fake-studio-trpc";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import { renderTab, studioValue } from "~/tests/helpers/studio-tab-fixtures";
import { STATUS, dryRun, resetWorldApplyTests } from "~/tests/helpers/world-apply-fixtures";

// jsdom has neither; the browser does
Object.assign(globalThis, { TextEncoder, TextDecoder });

afterEach(() => jest.restoreAllMocks());

const BADLANDS: StudioPreset = {
  slug: "badlands",
  name: "Badlands",
  builtIn: false,
  hasDraft: true,
  published: true,
  params: { terrainRoughness: 0.9 },
};

describe("the Presets tab", () => {
  const PRESETS = [...FACTORY_STUDIO_PRESETS, BADLANDS];
  /** The rail holds the preset's own values plus a seed that must never be sent. */
  const railParams = (): StudioParams =>
    ({ ...paramsForPreset({ terrainRoughness: 0.9 }), seed: 4242 }) as StudioParams;
  const withPreset = (slug: string, over: Parameters<typeof studioValue>[0] = {}) => {
    const preset = PRESETS.find((p) => p.slug === slug)!;
    return studioValue({
      presets: PRESETS,
      presetSlug: slug,
      presetParams: paramsForPreset(preset.params),
      params: railParams(),
      ...over,
    });
  };
  const summary = {
    slug: "badlands",
    name: "Badlands",
    description: "",
    builtIn: false,
    sortOrder: 3,
    published: null,
    draft: null,
    archived: false,
  };

  beforeEach(() => {
    mockTrpc.use = "studio";
    resetStudioTrpc();
    versionsQuery.mockReturnValue({ data: [], isError: false });
    for (const write of Object.values(presetWrites)) write.mockResolvedValue(summary);
  });

  it("saves the rail as the preset's draft without the seed, and publishes only once asked", async () => {
    renderTab(<StudioPresetsTab />, withPreset("badlands"));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft saved.");
    expect(presetWrites.saveDraft).toHaveBeenCalledTimes(1);
    const { slug, params } = presetWrites.saveDraft.mock.calls[0]![0] as {
      slug: string;
      params: Record<string, unknown>;
    };
    expect(slug).toBe("badlands");
    expect("seed" in params).toBe(false);
    expect(params.terrainRoughness).toBe(0.9);

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(presetWrites.publish).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Publish" })
    );
    await screen.findByText("Published.");
    expect(presetWrites.publish).toHaveBeenCalledWith({ slug: "badlands" });
  });

  it("offers no write while the presets are the built-ins from code", () => {
    renderTab(<StudioPresetsTab />, withPreset("eurth", { presetsFallback: true }));
    const writes = [
      "Save draft",
      "Publish",
      "Reset to factory",
      "Rename",
      "Save as new",
      "Move Earth-like down",
    ];
    expect(
      writes.map((name) => [name, screen.getByRole("button", { name }).hasAttribute("disabled")])
    ).toEqual(writes.map((name) => [name, true]));
  });
});

describe("the Studio's saved recipe", () => {
  beforeEach(() => window.localStorage.clear());

  it("is not written while the built-in presets stand in, and keeps its preset", () => {
    saveStudioRecipe("user_1", {
      seed: 5,
      preset: "badlands",
      mode: "preset",
      fitRealm: null,
      params: paramsForPreset({ plateCount: 20 }),
    });
    const { result } = renderHook(() =>
      useStudioRecipe({
        userId: "user_1",
        presets: FACTORY_STUDIO_PRESETS,
        fitParam: null,
        persist: false,
      })
    );
    expect(result.current.presetSlug).toBe("earthlike");
    act(() => result.current.setParams({ cellCount: 5000 }));
    act(() => result.current.setSeed(99));
    const stored = JSON.parse(window.localStorage.getItem(studioRecipeKey("user_1")) ?? "null");
    expect(stored).toMatchObject({ seed: 5, preset: "badlands" });
  });
});

describe("the Ship tab's apply to a realm", () => {
  beforeEach(() => {
    mockTrpc.use = "studio";
    resetStudioTrpc();
    resetWorldApplyTests();
    applyStatusQuery.mockReturnValue({ data: STATUS, isError: false });
  });
  const fitted = (realm: string): Partial<StudioContextValue> => ({
    source: { kind: "fit", preset: "earthlike", realm },
    fit: {
      state: "ready",
      landMaskLayers: {},
      mapVersion: 5,
      maskKey: `${realm}:5`,
      retry: jest.fn(),
    },
  });
  const tick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name }));

  it("sends Ixnay only the ticked layers the world in view was made with, and nothing without one", async () => {
    const base = studioValue(fitted("ixnay"));
    const result = worldResult({ params: { ...base.generator.result!.params, hasIcecaps: false } });
    renderTab(
      <StudioShipTab />,
      studioValue({ ...fitted("ixnay"), generator: { ...base.generator, result } })
    );
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();
    // The world in view has no ice: it can't be ticked, so it can't be written over Ixnay's
    expect(screen.getByRole("checkbox", { name: "Ice" })).toBeDisabled();
    tick("Ice");
    expect(screen.queryByRole("button", { name: "Use this world" })).toBeNull();

    tick("Rivers");
    tick("Elevation");
    fireEvent.click(await screen.findByRole("button", { name: "Use this world" }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        realmId: "r_ixnay",
        kind: "world",
        fittedMapVersion: 5,
        options: { layers: ["altitudes", "rivers"] },
      })
    );

    // Unticking the last layer takes the way on away again
    act(() => setJob("j_check", { ...dryRun({ source: "realm-map" }), realmId: "r_ixnay" }));
    tick("Rivers");
    tick("Elevation");
    expect(screen.getByText("Tick at least one layer to write to Ixnay.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply this world" })).toBeNull();
  });

  it("holds the apply while the realm's lock cannot be read, and offers to ask again", () => {
    const refetch = jest.fn();
    applyStatusQuery.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("down"),
      refetch,
    });
    renderTab(<StudioShipTab />);
    fireEvent.change(screen.getByRole("combobox", { name: "Realm to apply to" }), {
      target: { value: "eurth" },
    });
    expect(screen.getByRole("button", { name: "Use this world" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check claims again" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("the admin map tools", () => {
  afterEach(() => {
    mockRole = "admin";
  });

  it("still guard the bare Studio route: a member gets Access denied, not the Studio", () => {
    mockRole = "member";
    render(
      <AdminLayout>
        <p>child</p>
      </AdminLayout>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("offer only the job actions a job allows, and ask before cancelling or rolling back", () => {
    mockTrpc.use = "atlas";
    resetFakeAtlas();
    state.overview = {
      partial: false,
      realms: [realmRow(), realmRow({ id: "r_b", slug: "borea", name: "Borea" })],
    };
    state.jobPages = [
      {
        jobs: [
          jobRow({ id: "queued", status: "queued", canCancel: true }),
          jobRow({ id: "failed", status: "failed", canRetry: true }),
          jobRow({ id: "done", canRollBack: true, importId: "imp_1" }),
          jobRow({ id: "plain" }),
        ],
        nextCursor: null,
      },
    ];
    responses["atlas.jobs.rollback"] = { restored: 3, deleted: 1 };
    render(<AtlasJobsTab />);
    const row = (id: string) =>
      screen.getByRole("button", { name: `Open Apply (PNG) ${id}` }).closest("tr")!;
    const actions = (id: string) =>
      within(row(id))
        .queryAllByRole("button")
        .map((button) => button.textContent)
        .filter((text) => text !== "Apply (PNG)");
    expect(actions("queued")).toEqual(["Cancel"]);
    expect(actions("failed")).toEqual(["Retry"]);
    expect(actions("done")).toEqual(["Roll back"]);
    expect(actions("plain")).toEqual([]);

    fireEvent.click(within(row("queued")).getByRole("button", { name: "Cancel" }));
    expect(atlasCalls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel job" }));
    expect(atlasCalls).toEqual([["atlas.jobs.cancel", { jobId: "queued" }]]);

    fireEvent.click(within(row("done")).getByRole("button", { name: "Roll back" }));
    expect(atlasCalls).toHaveLength(1);
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "nations or slots it made are removed"
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Roll back" })
    );
    expect(atlasCalls.at(-1)).toEqual(["atlas.jobs.rollback", { importId: "imp_1" }]);
  });

  it("round-trip a realm's stored map pipeline unchanged, and hold it back with each bad art row named", () => {
    const stored = sourcePreset("eurth-map")!.mapPipeline!;
    const draft = toDraft(stored);
    expect(stableJson(draftPipeline(draft))).toBe(stableJson(stored));
    const saved = validateDraft(draft);
    expect(saved.errors).toEqual({});
    expect(stableJson(saved.pipeline)).toBe(stableJson(stored));

    const broken = validateDraft({
      ...draft,
      art: [
        { key: "blank", source: { repoPath: "Blank.png" } },
        { key: "geography", source: { repoPath: "" } },
        { key: "geography", source: { uploadId: "" } },
        { key: "Bad Key", source: { repoPath: "x.png" } },
      ],
    });
    expect(broken.pipeline).toBeNull();
    expect(broken.errors["art.1.source"]).toBeDefined();
    expect(broken.errors["art.2.key"]).toBe('"geography" is used twice');
    expect(broken.errors["art.2.source"]).toBe("Upload a file");
    expect(broken.errors["art.3.key"]).toMatch(/lower case letters/);
  });
});
