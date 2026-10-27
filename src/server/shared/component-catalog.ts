import { z } from "zod";

export const getAllComponentsSchema = z
  .object({
    category: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .optional();

type CatalogComponent = { type: string; category: string; name: string; usageCount?: number };

/**
 * The code-library component catalog, filtered and sorted, with usage counts merged in from
 * the database (the library is the only catalog; the table only keeps usage counts).
 * A failing usage read leaves the library's zero counts.
 */
export async function listCatalogComponents<C extends CatalogComponent>(options: {
  label: string;
  library: () => C[];
  input: z.infer<typeof getAllComponentsSchema>;
  loadUsage: () => Promise<Array<{ componentType: string; usageCount: number }>>;
}) {
  const { input } = options;
  let components = (input?.isActive === false ? [] : options.library())
    .filter((comp) => !input?.category || comp.category === input.category)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  try {
    const usage = await options.loadUsage();
    const usageByType = new Map(usage.map((row) => [row.componentType, row.usageCount]));
    components = components.map((comp) => ({
      ...comp,
      usageCount: usageByType.get(comp.type) ?? 0,
    }));
  } catch (error) {
    console.error(`[${options.label}] Failed to read usage counts:`, error);
  }

  return { success: true, components, count: components.length };
}
