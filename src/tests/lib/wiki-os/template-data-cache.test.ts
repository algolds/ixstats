/** @jest-environment node */
/**
 * `wikios.getTemplateData`'s registry rows (template-data-cache.ts). Every spelling of a template's title is one row,
 * named as MediaWiki titles the template ("infobox_country", "infobox country" and "Template:Infobox country" are
 * "Infobox country"; "Infobox Country" is another template). A row is served while it is newer than the template's
 * page and /doc; an edit to either after it was written makes the next read take the TemplateData from the stored
 * wikitext again. No row is created for a template that does not exist, and an administrator's row for a template
 * with no page in WikiOS is served as it is.
 */
interface Row {
  name: string;
  description: string | null;
  category: string | null;
  templateData: unknown;
  paramCount: number;
  isCanonical: boolean;
  canonicalTarget: string | null;
  lastSynced: Date;
}
interface Page {
  title: string;
  wikitext: string;
  status: string;
  updatedAt: Date;
}
const rows = new Map<string, Row>();
const pages = new Map<string, Page>();

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiTemplate: {
      findUnique: jest.fn(async ({ where }: { where: { name: string } }) =>
        rows.has(where.name) ? { ...rows.get(where.name)! } : null
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { name: string };
          create: Partial<Row>;
          update: Partial<Row>;
        }) => {
          const before = rows.get(where.name);
          const row = before
            ? { ...before, ...update }
            : ({ isCanonical: false, canonicalTarget: null, ...create } as Row);
          rows.set(where.name, row);
          return row;
        }
      ),
      update: jest.fn(async ({ where, data }: { where: { name: string }; data: Partial<Row> }) => {
        const row = { ...rows.get(where.name)!, ...data };
        rows.set(where.name, row);
        return row;
      }),
    },
    wikiArticle: {
      findMany: jest.fn(
        async ({ where }: { where: { title: { in: string[] }; status?: string } }) =>
          where.title.in.flatMap((title) => {
            const page = pages.get(title);
            return page && (!where.status || page.status === where.status) ? [page] : [];
          })
      ),
    },
  },
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { templateDataFor, templateRowName } from "~/lib/wiki-os/templates/template-data-cache";

const td = (description: string) =>
  `<templatedata>${JSON.stringify({ description, params: { name: { label: "Name" } } })}</templatedata>`;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 0, minute));
const putPage = (title: string, wikitext: string, minute: number) =>
  pages.set(title, { title, wikitext, status: "PUBLISHED", updatedAt: at(minute) });

beforeEach(() => {
  rows.clear();
  pages.clear();
});

describe("templateRowName", () => {
  it("names the template as MediaWiki titles it", () => {
    expect(templateRowName("infobox_country")).toBe("Infobox country");
    expect(templateRowName(" Template:infobox country ")).toBe("Infobox country");
    expect(templateRowName("Infobox Country")).toBe("Infobox Country");
    expect(templateRowName("a|b")).toBeNull();
  });
});

describe("templateDataFor", () => {
  it("keeps one row for every spelling of a template's title", async () => {
    putPage("Template:Infobox country", td("Countries"), 0);

    for (const spelling of ["Infobox_country", "infobox country", "Template:Infobox country"]) {
      expect(await templateDataFor(spelling)).toMatchObject({
        name: "Infobox country",
        templateData: { description: "Countries" },
      });
    }
    expect([...rows.keys()]).toEqual(["Infobox country"]);
  });

  it("reads the TemplateData again once the template or its /doc changed after the row", async () => {
    putPage("Template:Infobox country", td("Old"), 0);
    expect(await templateDataFor("Infobox country")).toMatchObject({ cached: false });
    expect(await templateDataFor("Infobox country")).toMatchObject({
      cached: true,
      templateData: { description: "Old" },
    });

    // the row was written "now"; an edit after it is newer
    const written = rows.get("Infobox country")!.lastSynced.getTime();
    pages.set("Template:Infobox country/doc", {
      title: "Template:Infobox country/doc",
      wikitext: td("New"),
      status: "PUBLISHED",
      updatedAt: new Date(written + 60_000),
    });
    pages.get("Template:Infobox country")!.wikitext = "{{documentation}}";
    expect(await templateDataFor("Infobox country")).toMatchObject({
      cached: false,
      templateData: { description: "New" },
    });
    expect((rows.get("Infobox country")!.templateData as { description: string }).description).toBe(
      "New"
    );
  });

  it("clears a row whose template no longer has TemplateData after an edit", async () => {
    putPage("Template:Flag", td("Flags"), 0);
    await templateDataFor("Flag");
    const written = rows.get("Flag")!.lastSynced.getTime();
    pages.set("Template:Flag", {
      title: "Template:Flag",
      wikitext: "no data",
      status: "PUBLISHED",
      updatedAt: new Date(written + 60_000),
    });

    expect(await templateDataFor("Flag")).toMatchObject({ templateData: null });
    expect(rows.get("Flag")!.templateData).toBe(Prisma.DbNull);
  });

  it("creates no row for a template that does not exist", async () => {
    expect(await templateDataFor("No such template")).toMatchObject({ templateData: null });
    expect(await templateDataFor("Infobox_nothing")).toMatchObject({ templateData: null });
    expect(rows.size).toBe(0);
  });

  it("serves an administrator's row for a template with no page in WikiOS", async () => {
    rows.set("Synced", {
      name: "Synced",
      description: "From MediaWiki",
      category: "general",
      templateData: { description: "From MediaWiki" },
      paramCount: 0,
      isCanonical: false,
      canonicalTarget: null,
      lastSynced: at(0),
    });

    expect(await templateDataFor("synced")).toMatchObject({
      name: "Synced",
      cached: true,
      templateData: { description: "From MediaWiki" },
    });
  });
});
