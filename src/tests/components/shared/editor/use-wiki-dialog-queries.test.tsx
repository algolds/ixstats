/**
 * The composer's wiki dialog asks the wikis only once typing pauses (300 ms): its search across every wiki (at most
 * 200 characters, never for one character or for the result just picked) and, in embed mode, the preview's intro and
 * images for the settled title. The first image an embed card can show is picked for it.
 */
import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import {
  WIKI_DIALOG_SEARCH_DELAY,
  useWikiDialogQueries,
} from "~/components/shared/editor/useWikiDialogQueries";
import type { WikiSource } from "~/lib/wiki-os/config";

interface Call {
  procedure: "search" | "getIntro" | "getPageImages";
  input: { query?: string; title?: string; wiki?: string; limit?: number; wikiSource?: string };
  enabled: boolean;
}
const calls: Call[] = [];
let mockImages: Array<{ title: string; url: string; thumbUrl: string }> | null | undefined;

jest.mock("~/trpc/react", () => {
  const procedure = (name: Call["procedure"], data: () => unknown) => ({
    useQuery: (input: Call["input"], options: { enabled: boolean }) => {
      calls.push({ procedure: name, input, enabled: options.enabled });
      return { data: options.enabled ? data() : undefined, isLoading: false, error: null };
    },
  });
  return {
    api: {
      wikios: {
        search: procedure("search", () => undefined),
        getIntro: procedure("getIntro", () => undefined),
        getPageImages: procedure("getPageImages", () => mockImages),
      },
    },
  };
});

/** What each procedure actually sent, in order (an enabled call per render; repeats collapsed). */
function sent(procedure: Call["procedure"]): string[] {
  const values = calls
    .filter((c) => c.procedure === procedure && c.enabled)
    .map((c) => c.input.query ?? c.input.title ?? "");
  return values.filter((value, i) => value !== values[i - 1]);
}
const lastOf = (procedure: Call["procedure"]) =>
  calls.filter((c) => c.procedure === procedure).at(-1)!;

beforeEach(() => {
  calls.length = 0;
  mockImages = undefined;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

interface Props {
  open?: boolean;
  embed?: boolean;
  source?: WikiSource;
}

/** The hook with the dialog's title as real state (`type` is typing it), its wiki and image setters spied. */
function setup(initialTarget: string, initial: Props = {}) {
  const setTarget = jest.fn();
  const setSource = jest.fn();
  const setImage = jest.fn();
  const hook = renderHook(
    ({ open = true, embed = false, source = "ixwiki" }: Props) => {
      const [target, setTargetState] = useState(initialTarget);
      const queries = useWikiDialogQueries({
        target,
        source,
        open,
        embed,
        setTarget: (title) => {
          setTarget(title);
          setTargetState(title);
        },
        setSource,
        setImage,
      });
      return { ...queries, type: setTargetState };
    },
    { initialProps: initial }
  );
  const type = (text: string) => act(() => hook.result.current.type(text));
  const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
  return { ...hook, type, wait, setTarget, setSource, setImage };
}

describe("useWikiDialogQueries: search", () => {
  it("searches all wikis only once typing pauses for 300 ms, for the last thing typed", () => {
    expect(WIKI_DIALOG_SEARCH_DELAY).toBe(300);
    const { type, wait } = setup("");
    for (const typed of ["G", "Ga", "Gal", "Gall"]) {
      type(typed);
      wait(100);
    }
    expect(sent("search")).toEqual([]);
    wait(199);
    expect(sent("search")).toEqual([]);
    wait(1);
    expect(sent("search")).toEqual(["Gall"]);
    expect(lastOf("search").input).toEqual({ query: "Gall", limit: 5, wikiSource: "all" });
  });

  it("trims the query and sends nothing for one character", () => {
    const { type, wait } = setup("");
    type("  Ga  ");
    wait(300);
    expect(lastOf("search").input.query).toBe("Ga");
    type(" G ");
    wait(300);
    expect(lastOf("search").enabled).toBe(false);
  });

  it("clamps a long title to the search's 200 characters", () => {
    const { type, wait } = setup("");
    type("x".repeat(450));
    wait(300);
    expect(lastOf("search").input.query).toBe("x".repeat(200));
    expect(lastOf("search").enabled).toBe(true);
  });

  it("sends nothing while the dialog is closed", () => {
    const { wait } = setup("Gallambria", { open: false });
    wait(300);
    expect(sent("search")).toEqual([]);
  });

  it("picking a result sets the title and its wiki, and does not search for it again", () => {
    const { result, type, wait, setTarget, setSource } = setup("");
    type("Gall");
    wait(300);
    expect(sent("search")).toEqual(["Gall"]);
    act(() => result.current.selectResult({ title: "Gallambria Republic", source: "iiwiki" }));
    expect(setTarget).toHaveBeenCalledWith("Gallambria Republic");
    expect(setSource).toHaveBeenCalledWith("iiwiki");
    wait(300);
    expect(lastOf("search").input.query).toBe("Gallambria Republic");
    expect(lastOf("search").enabled).toBe(false);
    expect(sent("search")).toEqual(["Gall"]);
  });

  it("the pick is forgotten once the title changes: typing back to it searches again", () => {
    const { result, type, wait } = setup("Gall");
    act(() => result.current.selectResult({ title: "Gallambria", source: "iiwiki" }));
    wait(300);
    expect(lastOf("search").enabled).toBe(false);
    type("Gallambri");
    wait(300);
    type("Gallambria");
    wait(300);
    expect(lastOf("search").enabled).toBe(true);
    expect(lastOf("search").input.query).toBe("Gallambria");
  });

  it("the pick is forgotten when the dialog closes", () => {
    const { result, wait, rerender } = setup("Gall");
    act(() => result.current.selectResult({ title: "Gallambria", source: "iiwiki" }));
    wait(300);
    expect(lastOf("search").enabled).toBe(false);
    rerender({ open: false });
    rerender({ open: true });
    wait(300);
    expect(lastOf("search").enabled).toBe(true);
  });
});

describe("useWikiDialogQueries: the embed preview", () => {
  const embed = { embed: true, source: "iiwiki" as const };

  it("asks for the intro and images only for the settled, trimmed title, never per keystroke", () => {
    const { result, type, wait } = setup("", embed);
    for (const typed of ["G", "Ga", "Gal", " Gallambria "]) {
      type(typed);
      wait(100);
    }
    expect(sent("getIntro")).toEqual([]);
    expect(sent("getPageImages")).toEqual([]);
    wait(300);
    expect(sent("getIntro")).toEqual(["Gallambria"]);
    expect(sent("getPageImages")).toEqual(["Gallambria"]);
    expect(lastOf("getIntro").input).toEqual({ title: "Gallambria", wiki: "iiwiki" });
    expect(lastOf("getPageImages").input).toEqual({ title: "Gallambria", wiki: "iiwiki" });
    expect(result.current.title).toBe("Gallambria");
  });

  it("asks nothing in link mode, with the dialog closed, or for an empty title", () => {
    const { rerender, type, wait } = setup("Gallambria", { embed: false });
    wait(300);
    rerender({ embed: true, open: false });
    wait(300);
    type("   ");
    wait(300);
    rerender({ embed: true });
    wait(300);
    expect(sent("getIntro")).toEqual([]);
    expect(sent("getPageImages")).toEqual([]);
  });

  it("picks the first image an embed card can show, not the first one listed", () => {
    mockImages = [
      { title: "File:Track.png", url: "https://evil.example/track.png", thumbUrl: "" },
      {
        title: "File:Flag.png",
        url: "https://iiwiki.com/images/a/ab/Flag.png",
        thumbUrl: "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png",
      },
    ];
    const { setImage, wait } = setup("Gallambria", embed);
    wait(300);
    expect(setImage).toHaveBeenLastCalledWith(
      "https://iiwiki.com/images/thumb/a/ab/Flag.png/300px-Flag.png"
    );
  });

  it("picks no image when none can be shown", () => {
    mockImages = [{ title: "File:Track.png", url: "https://evil.example/track.png", thumbUrl: "" }];
    const { setImage, wait } = setup("Gallambria", embed);
    wait(300);
    expect(setImage).toHaveBeenLastCalledWith("");
  });
});
