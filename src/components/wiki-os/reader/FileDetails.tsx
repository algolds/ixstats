// What a `File:` page shows below its description (plan 411): the file's upload history and the pages that use it.
// Plain markup, rendered on the server so crawlers follow every link.

import Link from "next/link";
import type {
  FileDetails as FileDetailsData,
  FileVersion,
} from "~/lib/wiki-os/core/file-page-service";

const TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const formatTime = (iso: string) => `${TIME.format(new Date(iso))} UTC`;

function formatBytes(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "640 × 480 pixels", or nothing for a file with no pixels. */
const dimensions = (version: FileVersion) =>
  version.width && version.height ? `${version.width} × ${version.height}` : "";

function History({ history }: { history: FileVersion[] }) {
  return (
    <section className="mt-6" id="filehistory">
      <h2 className="text-foreground mb-2 text-sm font-bold">File history</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Date and time</th>
              <th className="py-1 pr-4 font-medium">Dimensions</th>
              <th className="py-1 pr-4 font-medium">Size</th>
              <th className="py-1 pr-4 font-medium">User</th>
              <th className="py-1 font-medium">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-border/20 divide-y">
            {history.map((version, index) => (
              <tr key={version.at}>
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  {formatTime(version.at)}
                  {index === 0 && <span className="text-muted-foreground"> (current)</span>}
                </td>
                <td className="py-1.5 pr-4 whitespace-nowrap">{dimensions(version)}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  {version.size ? formatBytes(version.size) : ""}
                </td>
                <td className="py-1.5 pr-4">
                  <Link
                    href={`/wiki/User:${encodeURIComponent(version.user.replace(/ /g, "_"))}`}
                    className="hover:text-wiki"
                    prefetch={false}
                  >
                    {version.user}
                  </Link>
                </td>
                <td className="text-muted-foreground py-1.5">{version.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Usage({ usage, total }: { usage: FileDetailsData["usage"]; total: number }) {
  return (
    <section className="mt-6" id="filelinks">
      <h2 className="text-foreground mb-2 text-sm font-bold">File usage</h2>
      {usage.length === 0 ? (
        <p className="text-muted-foreground text-xs">No pages use this file.</p>
      ) : (
        <>
          <p className="text-muted-foreground mb-2 text-xs">
            {total === 1 ? "This page uses" : `These ${total.toLocaleString("en-US")} pages use`}{" "}
            this file:
          </p>
          <ul className="columns-1 gap-6 text-sm sm:columns-2 lg:columns-3">
            {usage.map((page) => (
              <li key={page.title} className="break-inside-avoid py-0.5">
                <Link href={`/wiki/${page.urlPath}`} className="hover:text-wiki" prefetch={false}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
          {total > usage.length && (
            <p className="text-muted-foreground mt-2 text-xs">
              Showing the first {usage.length.toLocaleString("en-US")} of{" "}
              {total.toLocaleString("en-US")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function FileDetails({ details }: { details: FileDetailsData }) {
  return (
    <div className="wikios-file-details mt-8 border-t border-white/10 pt-2">
      {details.history.length > 0 && <History history={details.history} />}
      <Usage usage={details.usage} total={details.usageTotal} />
    </div>
  );
}
