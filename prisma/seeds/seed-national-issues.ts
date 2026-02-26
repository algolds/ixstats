/**
 * Seed script for National Issue Templates
 *
 * Usage: npx tsx prisma/seeds/seed-national-issues.ts
 *
 * This script upserts all templates (keyed by slug) so it's safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";
import { NATIONAL_ISSUE_TEMPLATES } from "./national-issue-templates";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${NATIONAL_ISSUE_TEMPLATES.length} national issue templates...`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const template of NATIONAL_ISSUE_TEMPLATES) {
    try {
      const result = await prisma.nationalIssueTemplate.upsert({
        where: { slug: template.slug },
        update: {
          title: template.title,
          description: template.description,
          longDescription: template.longDescription ?? null,
          domain: template.domain,
          category: template.category as any,
          tags: template.tags ?? null,
          baseSeverity: template.baseSeverity as any,
          baseUrgency: template.baseUrgency,
          deadlineDaysBase: template.deadlineDaysBase,
          triggerConditions: template.triggerConditions,
          cooldownDays: template.cooldownDays,
          maxActivePerCountry: template.maxActivePerCountry,
          responseOptions: template.responseOptions,
          followUpTemplateIds: template.followUpTemplateIds ?? null,
          personalityModifiers: template.personalityModifiers ?? null,
          isActive: true,
        },
        create: {
          slug: template.slug,
          title: template.title,
          description: template.description,
          longDescription: template.longDescription ?? null,
          domain: template.domain,
          category: template.category as any,
          tags: template.tags ?? null,
          baseSeverity: template.baseSeverity as any,
          baseUrgency: template.baseUrgency,
          deadlineDaysBase: template.deadlineDaysBase,
          triggerConditions: template.triggerConditions,
          cooldownDays: template.cooldownDays,
          maxActivePerCountry: template.maxActivePerCountry,
          responseOptions: template.responseOptions,
          followUpTemplateIds: template.followUpTemplateIds ?? null,
          personalityModifiers: template.personalityModifiers ?? null,
          isActive: true,
        },
      });

      const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
      if (isNew) {
        created++;
      } else {
        updated++;
      }
    } catch (error) {
      errors++;
      console.error(`  Error seeding "${template.slug}":`, error);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${NATIONAL_ISSUE_TEMPLATES.length}`);

  // Domain breakdown
  const domainCounts: Record<string, number> = {};
  for (const t of NATIONAL_ISSUE_TEMPLATES) {
    domainCounts[t.domain] = (domainCounts[t.domain] ?? 0) + 1;
  }
  console.log(`\nDomain breakdown:`);
  for (const [domain, count] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${domain}: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
