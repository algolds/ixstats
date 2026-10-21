/** @jest-environment node */
/**
 * The store-only zip writer, read back the way an unzip tool does: end of central directory, then the central
 * directory, then each local file header and its data, checking names, sizes and CRC32.
 */
import { crc32, zipStore, type ZipEntry } from "~/lib/worldgen/zip-store";

const utf8 = new TextEncoder();
const text = new TextDecoder();

interface ReadEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  method: number;
  flags: number;
  localOffset: number;
}

/** Reads a zip back without inflating (every entry must be stored). */
function readZip(zip: Uint8Array): ReadEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  expect(view.getUint16(eocd + 8, true)).toBe(count);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryAt = view.getUint32(eocd + 16, true);
  expect(directoryAt + directorySize).toBe(eocd);
  expect(view.getUint16(eocd + 20, true)).toBe(0);

  const entries: ReadEntry[] = [];
  let at = directoryAt;
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = text.decode(zip.subarray(at + 46, at + 46 + nameLength));
    expect(compressed).toBe(size);

    // The local header says the same thing, and the data follows its name
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    expect(view.getUint32(localOffset + 18, true)).toBe(size);
    expect(view.getUint32(localOffset + 22, true)).toBe(size);
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const dataAt = localOffset + 30 + localName + localExtra;
    entries.push({
      name,
      data: zip.subarray(dataAt, dataAt + size),
      crc,
      method,
      flags,
      localOffset,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  expect(at).toBe(eocd);
  return entries;
}

const file = (name: string, content: string): ZipEntry => ({ name, data: utf8.encode(content) });

describe("worldgen/zip-store", () => {
  it("matches the known CRC32 values", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(utf8.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(utf8.encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });

  it("writes an archive that reads back name for name and byte for byte", () => {
    const files = [
      file("political.geojson", '{"type":"FeatureCollection","features":[]}'),
      file("background.geojson", "a".repeat(5000)),
      file("empty.geojson", ""),
    ];
    const entries = readZip(zipStore(files));
    expect(entries.map((e) => e.name)).toEqual(files.map((f) => f.name));
    entries.forEach((entry, i) => {
      expect(Array.from(entry.data)).toEqual(Array.from(files[i]!.data));
      expect(entry.crc).toBe(crc32(files[i]!.data));
      expect(entry.method).toBe(0);
    });
  });
  it("refuses a name that is empty or twice in the archive", () => {
    expect(() => zipStore([file("", "x")])).toThrow(/name/i);
    expect(() => zipStore([file("a", "x"), file("a", "y")])).toThrow(/twice|duplicate/i);
  });
});
