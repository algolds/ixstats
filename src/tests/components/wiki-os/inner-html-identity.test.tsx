// Plan 415 (F19): React 19 writes a `dangerouslySetInnerHTML` element's HTML again whenever the prop is a new
// object, even for the same string. A component that builds `{ __html }` in its render therefore replaces its DOM
// (images reload, scroll and selection reset, added links vanish) on every render of its parent. One object per
// HTML string leaves the nodes alone until the HTML itself changes.
import React from "react";
import { render } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { useHtmlMarkup } from "~/components/wiki-os/shared/useHtmlMarkup";
import { StashPagesList } from "~/components/wiki-os/stashes/StashPagesList";

const root = process.cwd();

function InlineObject({ html }: { html: string }) {
  return <div data-testid="host" dangerouslySetInnerHTML={{ __html: html }} />;
}

function MemoisedObject({ html }: { html: string }) {
  const markup = useHtmlMarkup(html);
  return <div data-testid="host" dangerouslySetInnerHTML={markup} />;
}

describe("a re-render with the same HTML", () => {
  it("rewrites the DOM when the `{ __html }` object is built in render (the bug, as a control)", () => {
    const { container, rerender } = render(<InlineObject html="<p><b>x</b></p>" />);
    const before = container.querySelector("b");

    rerender(<InlineObject html="<p><b>x</b></p>" />);

    expect(container.querySelector("b")).not.toBe(before);
  });

  it("leaves the nodes alone when the object is built once per string (useHtmlMarkup)", () => {
    const { container, rerender } = render(<MemoisedObject html="<p><b>x</b></p>" />);
    const before = container.querySelector("b");

    rerender(<MemoisedObject html="<p><b>x</b></p>" />);
    rerender(<MemoisedObject html="<p><b>x</b></p>" />);

    expect(container.querySelector("b")).toBe(before);
  });

  it("writes the new HTML when the string changes", () => {
    const { container, rerender } = render(<MemoisedObject html="<p><b>x</b></p>" />);

    rerender(<MemoisedObject html="<p><i>y</i></p>" />);

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("i")?.textContent).toBe("y");
  });

  it("is what a stash's note does across a re-render of its list (a real WikiOS component)", () => {
    const item = { id: "1", pageTitle: "Aurelia", pageSlug: "Aurelia", savedAt: "2026-01-01T00:00:00Z", note: "<b>keep me</b>" };
    const { container, rerender } = render(<StashPagesList items={[item]} onUnstash={() => {}} />);
    const note = container.querySelector("b");
    expect(note?.textContent).toBe("keep me");

    // a new items array and a new item object (as a refetch gives), the same note
    rerender(<StashPagesList items={[{ ...item }]} onUnstash={() => {}} thumbnailsMap={{}} />);

    expect(container.querySelector("b")).toBe(note);
  });
});

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

describe("src/components/wiki-os", () => {
  it("builds no `{ __html }` object inline in a dangerouslySetInnerHTML prop", () => {
    const inline = /dangerouslySetInnerHTML(?:=\{\{|:\s*\{)/;
    const offenders = sourceFiles("src/components/wiki-os").filter((file) =>
      inline.test(readFileSync(join(root, file), "utf8"))
    );

    expect(offenders).toEqual([]);
  });
});
