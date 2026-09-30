/** @jest-environment node */
import { gzipSync } from "node:zlib";
import { byteLimit, openUpload, PayloadTooLargeError } from "~/lib/wiki-os/xml/upload-stream";

const streamOf = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

async function collect(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of source) parts.push(Buffer.from(chunk));
  return Buffer.concat(parts);
}

const limits = { maxBytes: 100, maxExpandedBytes: 1000 };

describe("byteLimit", () => {
  async function through(chunks: Uint8Array[], limit: number) {
    const out: Uint8Array[] = [];
    const reader = streamOf(chunks).pipeThrough(byteLimit(limit, "The thing")).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return out;
      out.push(value);
    }
  }

  it("passes exactly `limit` bytes and fails on the byte after", async () => {
    await expect(through([new Uint8Array(60), new Uint8Array(40)], 100)).resolves.toHaveLength(2);
    await expect(through([new Uint8Array(60), new Uint8Array(41)], 100)).rejects.toThrow(
      PayloadTooLargeError
    );
  });

  it("fails on a single chunk over the limit, and says what and how much", async () => {
    await expect(through([new Uint8Array(101)], 100)).rejects.toThrow(
      "The thing is larger than 100 bytes"
    );
  });
});

describe("openUpload", () => {
  it("passes a plain body through unchanged, in its own chunks", async () => {
    const out = await collect(
      openUpload(streamOf([Buffer.from("<a>"), Buffer.from("x</a>")]), { ...limits, gzip: false })
    );

    expect(out.toString()).toBe("<a>x</a>");
  });

  it("fails a plain body past maxBytes", async () => {
    await expect(
      collect(openUpload(streamOf([new Uint8Array(101)]), { ...limits, gzip: false }))
    ).rejects.toThrow(PayloadTooLargeError);
  });

  it("gunzips a gzip body, however it is chunked", async () => {
    const archive = gzipSync("hello dump ".repeat(20));
    const pieces = Array.from({ length: Math.ceil(archive.length / 7) }, (_, i) =>
      archive.subarray(i * 7, i * 7 + 7)
    );

    const out = await collect(openUpload(streamOf(pieces), { ...limits, gzip: true }));

    expect(out.toString()).toBe("hello dump ".repeat(20));
  });

  it("bounds a gzip body by the bytes sent, not by what they expand to", async () => {
    const archive = gzipSync(Buffer.alloc(10, 1));
    const small = { maxBytes: archive.length - 1, maxExpandedBytes: 1000 };

    await expect(
      collect(openUpload(streamOf([archive]), { ...small, gzip: true }))
    ).rejects.toThrow("The upload is larger than");
  });

  it("bounds what a small archive expands to (a gzip bomb)", async () => {
    const bomb = gzipSync(Buffer.alloc(5_000_000));
    expect(bomb.length).toBeLessThan(10_000);

    await expect(
      collect(
        openUpload(streamOf([bomb]), { maxBytes: 100_000, maxExpandedBytes: 50_000, gzip: true })
      )
    ).rejects.toThrow("The decompressed dump is larger than 50000 bytes");
  });

  it("fails on a corrupt or truncated archive", async () => {
    const archive = gzipSync("x".repeat(1000));

    await expect(
      collect(openUpload(streamOf([Buffer.from("not gzip at all")]), { ...limits, gzip: true }))
    ).rejects.toThrow();
    await expect(
      collect(openUpload(streamOf([archive.subarray(0, 10)]), { ...limits, gzip: true }))
    ).rejects.toThrow();
  });
});
