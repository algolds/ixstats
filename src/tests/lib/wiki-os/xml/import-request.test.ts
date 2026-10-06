/** @jest-environment node */
import {
  contentTypeFor,
  DEFAULT_MAX_UPLOAD_BYTES,
  formatLimit,
  uploadKind,
} from "~/lib/wiki-os/xml/import-request";

describe("uploadKind", () => {
  it.each([
    ["application/xml", "xml"],
    ["text/xml", "xml"],
    ["Application/XML; charset=utf-8", "xml"],
    ["application/gzip", "gzip"],
    ["application/x-gzip", "gzip"],
    ["application/gzip; q=1", "gzip"],
  ])("%s is %s", (type, kind) => {
    expect(uploadKind(type)).toBe(kind);
  });

  it.each([
    null,
    "",
    "multipart/form-data; boundary=x",
    "application/json",
    "application/octet-stream",
    "text/plain",
    "application/zip",
  ])("%p is neither", (type) => {
    expect(uploadKind(type)).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("sends .gz files as gzip whatever the browser called them", () => {
    expect(contentTypeFor({ name: "ixwiki.xml.gz", type: "application/x-gzip" })).toBe(
      "application/gzip"
    );
    expect(contentTypeFor({ name: "ixwiki.xml.gz", type: "application/octet-stream" })).toBe(
      "application/gzip"
    );
    expect(contentTypeFor({ name: "ixwiki.XML.GZ", type: "" })).toBe("application/gzip");
  });

  it("keeps an XML type, and defaults an empty or odd one to application/xml", () => {
    expect(contentTypeFor({ name: "a.xml", type: "text/xml" })).toBe("text/xml");
    expect(contentTypeFor({ name: "a.xml", type: "application/xml" })).toBe("application/xml");
    expect(contentTypeFor({ name: "a.xml", type: "" })).toBe("application/xml");
    expect(contentTypeFor({ name: "a.xml", type: "application/octet-stream" })).toBe(
      "application/xml"
    );
  });
});

describe("the limit", () => {
  it("is 9.5 MiB of body, which the page words as 10 MB", () => {
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(9_961_472);
    expect(formatLimit(DEFAULT_MAX_UPLOAD_BYTES)).toBe("10 MB");
    expect(formatLimit(51_904_512)).toBe("52 MB");
  });
});
