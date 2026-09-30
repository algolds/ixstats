/**
 * useNotify is the platform's one toast API (sonner + Facet ToastBanner underneath).
 * Guards the severity → queue/sound mapping and that no parallel toast path creeps back.
 */
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { useToastQueueStore } from "~/stores/toastQueueStore";

jest.mock("~/lib/sound/cuelume", () => ({
  soundEffects: {
    success: jest.fn(),
    error: jest.fn(),
    bloom: jest.fn(),
    chime: jest.fn(),
    pulse: jest.fn(),
  },
}));

const srcDir = path.resolve(__dirname, "../..");
const testsDir = path.join(srcDir, "tests");

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === testsDir ? [] : listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const queue = () => useToastQueueStore.getState().queue;

describe("useNotify severities", () => {
  const notify = renderHook(() => useNotify()).result.current;

  beforeEach(() => {
    jest.clearAllMocks();
    useToastQueueStore.setState({ queue: [] });
  });

  it.each([
    ["success", "medium", soundEffects.success],
    ["error", "high", soundEffects.error],
    ["warning", "medium", soundEffects.bloom],
    ["info", "medium", soundEffects.chime],
  ] as const)("%s → %s priority toast with its cue", (type, priority, sound) => {
    notify[type]("Title", "Body");

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ type, priority, title: "Title", message: "Body" });
    expect(sound).toHaveBeenCalledTimes(1);
  });

  it("critical priority plays the pulse cue instead of the type cue", () => {
    notify.error("Breach", undefined, { priority: "critical" });

    expect(soundEffects.pulse).toHaveBeenCalledTimes(1);
    expect(soundEffects.error).not.toHaveBeenCalled();
  });

  it("low priority and silent calls raise no toast", () => {
    notify.info("Quiet", undefined, { priority: "low" });
    notify.info("Silent", undefined, { silent: true });

    expect(queue()).toHaveLength(0);
    expect(soundEffects.chime).not.toHaveBeenCalled();
  });

  it("a repeated id replaces the toast instead of stacking", () => {
    notify.warning("First", undefined, { id: "same" });
    notify.warning("Second", undefined, { id: "same" });

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ id: "same", title: "Second" });
  });
});

describe("single toast system", () => {
  it("only the Toaster mount and the toast queue import sonner", () => {
    const allowed = ["components/ui/toast.tsx", "stores/toastQueueStore.ts"];
    const offenders = listSourceFiles(srcDir)
      .map((file) => path.relative(srcDir, file))
      .filter((rel) => !allowed.includes(rel))
      .filter((rel) => /from\s+["']sonner["']/.test(fs.readFileSync(path.join(srcDir, rel), "utf-8")));
    expect(offenders).toEqual([]);
  });

  it("the removed useToast facade has no importers", () => {
    const offenders = listSourceFiles(srcDir)
      .filter((file) =>
        /\b(useToast|useToastHelpers|ToastProvider)\b/.test(fs.readFileSync(file, "utf-8"))
      )
      .map((file) => path.relative(srcDir, file));
    expect(offenders).toEqual([]);
  });
});
