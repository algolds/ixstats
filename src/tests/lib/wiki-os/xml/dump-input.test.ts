/** @jest-environment node */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { openDumpInput } from "~/lib/wiki-os/xml/dump-input";
import { readExport, type ImportEvent } from "~/lib/wiki-os/xml/import-reader";

const XML =
  "<mediawiki><page><title>Foo</title><ns>0</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>hi</text></revision></page></mediawiki>";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dump-input-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function titles(stream: Readable): Promise<string[]> {
  const found: string[] = [];
  for await (const event of readExport(stream) as AsyncIterable<ImportEvent>) {
    if (event.type === "page") found.push(event.page.title);
  }
  return found;
}

describe("openDumpInput", () => {
  it("reads a plain file, a gzip file and stdin", async () => {
    const plain = join(dir, "dump.xml");
    const gz = join(dir, "dump.xml.gz");
    writeFileSync(plain, XML);
    writeFileSync(gz, gzipSync(XML));

    expect(await titles(openDumpInput(plain, Readable.from([])))).toEqual(["Foo"]);
    expect(await titles(openDumpInput(gz, Readable.from([])))).toEqual(["Foo"]);
    expect(await titles(openDumpInput("-", Readable.from([XML])))).toEqual(["Foo"]);
  });

  it("reports a missing plain file as an error of the stream", async () => {
    await expect(
      titles(openDumpInput(join(dir, "missing.xml"), Readable.from([])))
    ).rejects.toThrow(/ENOENT/);
  });

  it("reports a missing .gz file as an error of the stream, not an unhandled crash or a hang", async () => {
    await expect(
      titles(openDumpInput(join(dir, "missing.xml.gz"), Readable.from([])))
    ).rejects.toThrow(/ENOENT/);
  });

  it("reports a .gz file that is not gzip, and a truncated one", async () => {
    const fake = join(dir, "fake.xml.gz");
    const cut = join(dir, "cut.xml.gz");
    writeFileSync(fake, XML);
    writeFileSync(cut, gzipSync(XML).subarray(0, 12));

    await expect(titles(openDumpInput(fake, Readable.from([])))).rejects.toThrow(/header|gzip/i);
    await expect(titles(openDumpInput(cut, Readable.from([])))).rejects.toThrow(/unexpected end/i);
  });
});
