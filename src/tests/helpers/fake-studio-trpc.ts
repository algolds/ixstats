/**
 * A stand-in for the tRPC pieces the Studio's Presets and Ship tabs use: the ten `atlas.presets` writes and the
 * versions query, `atlas.studio.applyStatus` and `createRealm`, the cache's `invalidate`, and (through
 * `fake-map-import`) the apply flow's `geoEditor.mapImport` calls. Every call is a `jest.fn()` the test answers.
 *
 * Use it as the whole mock: `jest.mock("~/trpc/react", () => jest.requireActual("~/tests/helpers/fake-studio-trpc"))`.
 */
import * as mapImport from "~/tests/helpers/fake-map-import";

export const presetWrites = {
  saveDraft: jest.fn(),
  create: jest.fn(),
  publish: jest.fn(),
  restore: jest.fn(),
  resetToFactory: jest.fn(),
  rename: jest.fn(),
  reorder: jest.fn(),
  archive: jest.fn(),
};
export const versionsQuery = jest.fn();
export const applyStatusQuery = jest.fn();
export const createRealm = jest.fn();
export const invalidate = {
  presetsList: jest.fn(),
  presetsVersions: jest.fn(),
  applyStatus: jest.fn(),
  realmMeasures: jest.fn(),
  overview: jest.fn(),
};

/** Run before each test: every call forgets its answers; the invalidations resolve. */
export function resetStudioTrpc() {
  for (const fn of [
    ...Object.values(presetWrites),
    versionsQuery,
    applyStatusQuery,
    createRealm,
    ...Object.values(invalidate),
  ]) {
    fn.mockReset();
  }
  for (const fn of Object.values(invalidate)) fn.mockResolvedValue(undefined);
  versionsQuery.mockReturnValue({ data: [], isError: false });
  mapImport.resetFakeMapImport();
}

const mutation = (fn: jest.Mock) => ({ useMutation: () => ({ mutateAsync: fn }) });
const mapImportUtils = mapImport.useUtils();

export const api = {
  geoEditor: mapImport.geoEditor,
  useUtils: () => ({
    ...mapImportUtils,
    atlas: {
      presets: {
        list: { invalidate: invalidate.presetsList },
        versions: { invalidate: invalidate.presetsVersions },
      },
      studio: {
        applyStatus: { invalidate: invalidate.applyStatus },
        realmMeasures: { invalidate: invalidate.realmMeasures },
      },
      realms: { overview: { invalidate: invalidate.overview } },
    },
  }),
  atlas: {
    presets: {
      ...Object.fromEntries(Object.entries(presetWrites).map(([name, fn]) => [name, mutation(fn)])),
      versions: { useQuery: (...args: object[]) => versionsQuery(...args) as object },
    },
    studio: {
      applyStatus: { useQuery: (...args: object[]) => applyStatusQuery(...args) as object },
      createRealm: mutation(createRealm),
    },
  },
};
