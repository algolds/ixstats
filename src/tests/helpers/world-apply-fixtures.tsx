/**
 * Shared set-up of the apply region's tests (world-apply.test.tsx, world-apply-resume.test.tsx): the fixtures the fake
 * server answers with and the render helpers. The test file mocks `~/trpc/react` (with `fake-map-import`) and
 * `encodeWorldBundle` (jsdom has no CompressionStream) before importing this.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { encodeWorldBundle } from "~/lib/maps/import/world-bundle";
import {
  WorldApplyRegion,
  type WorldApplyRegionProps,
  type WorldLock,
} from "~/components/maps/editor/panels/WorldApplyRegion";
import {
  applyWorld,
  calls,
  rebuildRelief,
  resetFakeMapImport,
  setJob,
  start,
} from "~/tests/helpers/fake-map-import";
import { worldResult } from "~/tests/helpers/fake-world-worker";

export const REALM = "r_eurth";
export const DRAFT = worldResult({ seed: 7 });

export const STATUS = {
  realmId: REALM,
  status: "active",
  pendingClaims: 0,
  approvedClaims: 0,
  locked: false,
  lockReason: null,
  canReviewClaims: true,
  reliefFailed: false,
} as const;
export const OPEN: WorldLock = { phase: "ready", status: STATUS };
export const claimsLock = (): WorldLock => ({
  phase: "ready",
  status: { ...STATUS, locked: true, lockReason: "claims", pendingClaims: 2 },
});

/** What tRPC raises for a refusal: an Error that carries the server's code. */
export const refusal = (message: string, code: string) =>
  Object.assign(new Error(message), { data: { code } });

export const UPLOAD = {
  uploadId: "a".repeat(64),
  kind: "world",
  filename: "world.json.gz",
  size: 9,
};

const counts = (create = 0, change = 0, retire = 0) => ({ create, change, retire });
export const dryRun = (over: object = {}) => ({
  status: "succeeded",
  progress: 100,
  stage: null,
  error: null,
  result: {
    phase: "world-dry-run",
    source: "preset",
    seed: 7,
    developmentLevel: "industrial",
    layers: {
      background: counts(1),
      altitudes: counts(4, 2, 1),
      climate: counts(6),
      political: counts(12, 0, 3),
      rivers: counts(30, 0, 25),
      lakes: counts(),
      icecaps: counts(2),
    },
    slots: { create: 12, retire: 3, keep: 2, renamed: 1 },
    warnings: [],
    replaces: [],
    ...over,
  },
});
type Relief = { status: string; version: string | null; tiles: number; error: string | null };
export const applied = (relief: Partial<Relief> = {}) => ({
  status: "succeeded",
  progress: 100,
  stage: null,
  error: null,
  result: {
    phase: "world-apply",
    written: 140,
    rejected: [],
    deactivated: 20,
    slots: { created: 12, retired: 3, opened: 12 },
    mapImportId: "i_1",
    rollbackAvailable: true,
    relief: { status: "built", version: "abc12345", tiles: 12, error: null, ...relief },
  },
});

export function respondToUpload(response: { status: number; body: object } | null = null) {
  global.fetch = jest.fn(async () => {
    calls.push("upload");
    const { status, body } = response ?? { status: 200, body: UPLOAD };
    return { ok: status < 400, status, json: async () => body } as Response;
  });
}

export function renderRegion(props: Partial<WorldApplyRegionProps> = {}) {
  const onDiscardDraft = jest.fn();
  const base: WorldApplyRegionProps = {
    realm: { id: REALM, slug: "eurth" },
    result: DRAFT,
    source: "preset",
    generating: false,
    stale: false,
    lock: OPEN,
    onDiscardDraft,
  };
  const view = render(<WorldApplyRegion {...base} {...props} />);
  return {
    onDiscardDraft,
    ...view,
    update: (next: Partial<WorldApplyRegionProps>) =>
      view.rerender(<WorldApplyRegion {...base} {...props} {...next} />),
  };
}

export const getUseButton = () => screen.getByRole("button", { name: "Use this world" });

/** Click Use this world and wait until the check has been queued and is being polled. */
export async function startCheck() {
  fireEvent.click(getUseButton());
  await screen.findByText(/Checking the world/);
}

/** The check finishes with `diff`; the review is up. */
export async function reachReview(diff = dryRun()) {
  await startCheck();
  act(() => setJob("j_check", diff));
  await screen.findByText("What this world changes");
}

/** Run before each test: nothing stored, the fake server fresh, the upload and the three calls answering. */
export function resetWorldApplyTests() {
  window.localStorage.clear();
  resetFakeMapImport();
  respondToUpload();
  jest.mocked(encodeWorldBundle).mockReset();
  jest.mocked(encodeWorldBundle).mockResolvedValue(new Uint8Array([0x1f, 0x8b, 0x08, 1, 2]));
  start.mockResolvedValue({ jobId: "j_check" });
  applyWorld.mockResolvedValue({ jobId: "j_apply" });
  rebuildRelief.mockResolvedValue({ source: "cells", version: "abc12345", built: true, tiles: 12 });
}
