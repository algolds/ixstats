// `?action=info`: the facts about a page, as MediaWiki's "Page information" table. Plain markup.

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import type { PageInfo } from "~/lib/wiki-os/core/page-info-service";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

const formatDate = (date: Date) =>
  date.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-white/10">
      <th scope="row" className="text-muted-foreground w-56 py-2 pr-4 text-left font-medium">
        {label}
      </th>
      <td className="text-foreground py-2">{children}</td>
    </tr>
  );
}

function Edit({ edit }: { edit: PageInfo["created"] }) {
  if (!edit) return <>unknown</>;
  return (
    <>
      {formatDate(edit.at)}
      {edit.by ? ` by ${edit.by}` : ""}
    </>
  );
}

export function PageInfoTable({ info }: { info: PageInfo }) {
  const canon = canonicalizeTitle(info.title);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      {canon && (
        <p className="mb-4">
          <Link href={withBasePath(articleHref(canon))} className="hover:text-wiki text-xs">
            &larr; Back to {info.title}
          </Link>
        </p>
      )}
      <table className="w-full border-collapse">
        <tbody>
          <Row label="Display title">{info.title}</Row>
          {info.pageId !== null && <Row label="Page ID">{info.pageId}</Row>}
          <Row label="Page length (in bytes)">{info.length.toLocaleString("en-US")}</Row>
          <Row label="Word count">{info.wordCount.toLocaleString("en-US")}</Row>
          <Row label="Page creation">
            <Edit edit={info.created} />
          </Row>
          <Row label="Latest edit">
            <Edit edit={info.lastEdited} />
          </Row>
          <Row label="Total number of edits">{info.revisionCount.toLocaleString("en-US")}</Row>
          {info.redirectsTo && (
            <Row label="Redirects to">{info.redirectsTo.replace(/_/g, " ")}</Row>
          )}
          <Row label="Redirects to this page">{info.redirectCount.toLocaleString("en-US")}</Row>
          <Row label="Categories">{info.categoryCount.toLocaleString("en-US")}</Row>
          <Row label="Edit protection">
            {info.protectionLevel === "ALL"
              ? "Everyone may edit"
              : `${info.protectionLevel.toLowerCase()}${
                  info.protectionExpiry ? ` until ${formatDate(info.protectionExpiry)}` : ""
                }`}
          </Row>
        </tbody>
      </table>
    </div>
  );
}
