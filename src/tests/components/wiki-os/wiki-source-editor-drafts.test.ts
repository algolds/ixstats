/**
 * The source editor does not ask about drafts itself (review fix 8): the edit bridge settles the
 * older-draft question with its own banner and hands the text to start from as `initialWikitext`.
 * A guard on the source, because rendering CodeMirror here would test nothing about drafts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "../../../components/wiki-os/editor/WikiSourceEditor.tsx"), "utf8");

describe("WikiSourceEditor", () => {
  it("never asks the browser to confirm a draft restore and does not read drafts", () => {
    expect(source).not.toMatch(/window\.confirm|\bconfirm\(/);
    expect(source).not.toMatch(/getDraft/);
  });

  it("hands the host a reader for its content", () => {
    expect(source).toContain("registerContentReader");
  });
});
