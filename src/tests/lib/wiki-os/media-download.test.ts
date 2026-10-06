/** @jest-environment node */
/**
 * Plan 416 item 6: `wikios.downloadFile` is public and used to buffer and base64 any URL. It now fetches
 * only from the hosts the media proxies trust (plan 401's allowlist), re-checks every redirect hop, and
 * stops at 10 MB.
 */
import { downloadMedia, MAX_DOWNLOAD_BYTES } from "~/lib/wiki-os/services/media-download";

const realFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const bytesOf = (n: number, fill = 7): Uint8Array<ArrayBuffer> => new Uint8Array(n).fill(fill);

/** A response whose body arrives in 1 MB chunks, so a size cap has to act on the stream. */
const streamed = (total: number, headers: Record<string, string> = {}): Response => {
  let sent = 0;
  const chunk = 1024 * 1024;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) return controller.close();
      const size = Math.min(chunk, total - sent);
      sent += size;
      controller.enqueue(bytesOf(size));
    },
  });
  return new Response(body, { status: 200, headers });
};

describe("downloadMedia: which hosts it will fetch", () => {
  it.each([
    "https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png",
    "https://ixwiki.com/images/a/ab/Flag.png",
    "https://iiwiki.com/images/Flag.png",
    "https://static.wikia.nocookie.net/althistory/images/Flag.png",
    "https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Flag.png",
  ])("fetches %s", async (url) => {
    fetchMock.mockResolvedValue(new Response(bytesOf(4), { status: 200 }));

    const bytes = await downloadMedia(url);

    expect(bytes?.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://evil.example/flag.png",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:5433/",
    "https://ixwiki.com.evil.example/flag.png",
    "file:///etc/passwd",
    "ftp://ixwiki.com/flag.png",
    "not a url",
  ])("never fetches %s", async (url) => {
    await expect(downloadMedia(url)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the allowlisted user agent", async () => {
    fetchMock.mockResolvedValue(new Response(bytesOf(1), { status: 200 }));

    await downloadMedia("https://iiwiki.com/images/Flag.png");

    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ "User-Agent": "IxStats-Builder" });
  });

  it("does not follow a redirect off the allowlist", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } })
    );

    await expect(downloadMedia("https://ixwiki.com/images/Flag.png")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect between allowlisted hosts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: "https://upload.wikimedia.org/x.png" },
        })
      )
      .mockResolvedValueOnce(new Response(bytesOf(3), { status: 200 }));

    await expect(downloadMedia("https://ixwiki.com/images/Flag.png")).resolves.toHaveLength(3);
  });

  it("gives null for an answer that is not OK", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));

    await expect(downloadMedia("https://ixwiki.com/images/Missing.png")).resolves.toBeNull();
  });
});

describe("downloadMedia: the 10 MB cap", () => {
  it("is 10 MB", () => {
    expect(MAX_DOWNLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("refuses a file whose Content-Length is over the cap without reading it", async () => {
    const res = streamed(1024, { "Content-Length": String(MAX_DOWNLOAD_BYTES + 1) });
    const cancel = jest.spyOn(res.body!, "cancel");
    fetchMock.mockResolvedValue(res);

    await expect(downloadMedia("https://ixwiki.com/images/Huge.png")).resolves.toBeNull();

    expect(cancel).toHaveBeenCalled();
  });

  it("stops reading a file that does not declare its size once it passes the cap", async () => {
    fetchMock.mockResolvedValue(streamed(MAX_DOWNLOAD_BYTES * 3));

    await expect(downloadMedia("https://ixwiki.com/images/Huge.png")).resolves.toBeNull();
  });

  it("returns a file of exactly the cap", async () => {
    fetchMock.mockResolvedValue(streamed(MAX_DOWNLOAD_BYTES));

    const bytes = await downloadMedia("https://ixwiki.com/images/Big.png");

    expect(bytes?.length).toBe(MAX_DOWNLOAD_BYTES);
  });

  it("returns the file's bytes intact", async () => {
    fetchMock.mockResolvedValue(new Response(Uint8Array.from([1, 2, 3, 250]), { status: 200 }));

    const bytes = await downloadMedia("https://ixwiki.com/images/Tiny.png");

    expect(Array.from(bytes!)).toEqual([1, 2, 3, 250]);
  });
});
