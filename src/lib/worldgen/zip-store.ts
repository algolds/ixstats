/**
 * A store-only zip writer (no compression), enough to hand several GeoJSON files over as one download. Pure: bytes in,
 * bytes out, no DOM and no node APIs. Names are UTF-8; sizes and counts stay within the classic 32-bit format.
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. `political.geojson` */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE) of `bytes`, as an unsigned integer. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;
const UTF8_NAMES = 0x0800;
const MAX_32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;

/** MS-DOS time and date words (two-second steps, years from 1980). */
function dosStamp(date: Date): { time: number; day: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface Placed {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/** The files as one zip archive, each stored as it is, in the order given. */
export function zipStore(entries: readonly ZipEntry[], modified: Date = new Date()): Uint8Array {
  if (entries.length > MAX_ENTRIES) throw new Error("Too many files for one zip archive");
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  let offset = 0;
  const placed: Placed[] = entries.map(({ name, data }) => {
    if (name === "") throw new Error("A zip entry needs a name");
    if (seen.has(name)) throw new Error(`The name ${name} is in the archive twice`);
    seen.add(name);
    const bytes = encoder.encode(name);
    const entry = { name: bytes, data, crc: crc32(data), offset };
    offset += LOCAL_HEADER + bytes.length + data.length;
    return entry;
  });
  const directoryAt = offset;
  const directorySize = placed.reduce((sum, e) => sum + CENTRAL_HEADER + e.name.length, 0);
  const total = directoryAt + directorySize + END_RECORD;
  if (total > MAX_32) throw new Error("The archive is too large for a zip file");

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const { time, day } = dosStamp(modified);
  let at = 0;
  for (const e of placed) {
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true); // version needed
    view.setUint16(at + 6, UTF8_NAMES, true);
    view.setUint16(at + 8, 0, true); // stored
    view.setUint16(at + 10, time, true);
    view.setUint16(at + 12, day, true);
    view.setUint32(at + 14, e.crc, true);
    view.setUint32(at + 18, e.data.length, true);
    view.setUint32(at + 22, e.data.length, true);
    view.setUint16(at + 26, e.name.length, true);
    out.set(e.name, at + LOCAL_HEADER);
    out.set(e.data, at + LOCAL_HEADER + e.name.length);
    at += LOCAL_HEADER + e.name.length + e.data.length;
  }
  for (const e of placed) {
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, 20, true); // made by
    view.setUint16(at + 6, 20, true); // version needed
    view.setUint16(at + 8, UTF8_NAMES, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, time, true);
    view.setUint16(at + 14, day, true);
    view.setUint32(at + 16, e.crc, true);
    view.setUint32(at + 20, e.data.length, true);
    view.setUint32(at + 24, e.data.length, true);
    view.setUint16(at + 28, e.name.length, true);
    view.setUint32(at + 42, e.offset, true);
    out.set(e.name, at + CENTRAL_HEADER);
    at += CENTRAL_HEADER + e.name.length;
  }
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, placed.length, true);
  view.setUint16(at + 10, placed.length, true);
  view.setUint32(at + 12, directorySize, true);
  view.setUint32(at + 16, directoryAt, true);
  return out;
}
