/**
 * template-data-cache.ts — `wikios.getTemplateData`'s registry tier: the `wiki_templates` row of a template, kept
 * in step with the template's pages.
 *
 * A row is keyed by the template's name as MediaWiki titles it (`templateRowName`: "infobox_country" and
 * "Infobox country" are one row, "Infobox Country" another), as the admin sync keys it. A row is read while it is
 * newer than the template's page and its `/doc` subpage in WikiOS; once either changed after the row was written
 * (`lastSynced`), the TemplateData is read again from the stored wikitext (`readTemplateData`) and the row updated.
 * A row is only ever created for a template whose page exists with TemplateData, so no caller can fill the table
 * with names of templates that do not exist. A row with no page in WikiOS (synced by an administrator from
 * MediaWiki) is served as it is.
 *
 * SERVER-ONLY: it reads and writes the database.
 */

import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { readTemplateData } from "~/lib/wiki-os/templates/template-data-reader";
import { categorizeTemplate } from "~/lib/wiki-os/templates/template-registry";

export interface TemplateDataAnswer {
  name: string;
  description: string | null;
  category: string | null;
  isCanonical?: boolean;
  templateData: Record<string, unknown> | null;
  cached: boolean;
}

const TEMPLATE_PREFIX = "Template:";

/** The template's name as its row is keyed: its page title without "Template:"; null when MediaWiki would refuse it. */
export function templateRowName(rawName: string): string | null {
  const name = rawName
    .trim()
    .replace(/^Template:/i, "")
    .trim();
  const canon = canonicalizeTitle(`${TEMPLATE_PREFIX}${name}`);
  return canon?.title.startsWith(TEMPLATE_PREFIX)
    ? canon.title.slice(TEMPLATE_PREFIX.length)
    : null;
}

/** When the template's page or its `/doc` subpage last changed in WikiOS; null when it has neither. */
async function pagesChangedAt(name: string): Promise<Date | null> {
  const page = `${TEMPLATE_PREFIX}${name}`;
  const pages = await db.wikiArticle.findMany({
    where: { source: "ixwiki", title: { in: [page, `${page}/doc`] } },
    select: { updatedAt: true },
    take: 2,
  });
  return pages.reduce<Date | null>(
    (latest, { updatedAt }) => (latest && latest >= updatedAt ? latest : updatedAt),
    null
  );
}

/** The answer of a template with no TemplateData. */
const noData = (name: string): TemplateDataAnswer => ({
  name,
  description: null,
  category: categorizeTemplate(name),
  templateData: null,
  cached: false,
});

/**
 * TemplateData of the template `rawName` names (with or without "Template:", any spelling of its title), from its
 * row while that is current, else from its stored wikitext (refreshing or creating the row).
 */
export async function templateDataFor(rawName: string): Promise<TemplateDataAnswer> {
  const name = templateRowName(rawName);
  if (!name)
    return noData(
      rawName
        .trim()
        .replace(/^Template:/i, "")
        .trim()
    );

  const row = await db.wikiTemplate.findUnique({ where: { name } });
  if (row?.canonicalTarget) {
    // an alias an administrator set: its target's row answers, as it is
    const target = await db.wikiTemplate.findUnique({ where: { name: row.canonicalTarget } });
    if (target?.templateData) {
      return {
        name: target.name,
        description: target.description,
        category: target.category,
        isCanonical: target.isCanonical,
        templateData: target.templateData as Record<string, unknown>,
        cached: true,
      };
    }
  }

  const changedAt = await pagesChangedAt(name);
  const current = row !== null && (changedAt === null || changedAt <= row.lastSynced);
  if (current && row?.templateData) {
    return {
      name: row.name,
      description: row.description,
      category: row.category,
      isCanonical: row.isCanonical,
      templateData: row.templateData as Record<string, unknown>,
      cached: true,
    };
  }
  if (changedAt === null) return noData(name); // no page, and no row with TemplateData

  const data = (await readTemplateData([name])).get(name);
  if (!data) {
    // the pages changed and hold no TemplateData now: a row that still has some is out of date
    if (row?.templateData) {
      await db.wikiTemplate.update({
        where: { name },
        data: { templateData: Prisma.DbNull, paramCount: 0, lastSynced: new Date() },
      });
    }
    return noData(name);
  }

  const category = categorizeTemplate(name, data.description);
  const fields = {
    description: data.description ?? null,
    category,
    templateData: data as unknown as Prisma.InputJsonValue,
    paramCount: Object.keys(data.params ?? {}).length,
    lastSynced: new Date(),
  };
  await db.wikiTemplate.upsert({
    where: { name },
    create: { name, ...fields },
    update: fields,
  });
  return {
    name,
    description: fields.description,
    category,
    templateData: data as unknown as Record<string, unknown>,
    cached: false,
  };
}
