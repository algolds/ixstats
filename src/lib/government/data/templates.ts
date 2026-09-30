import type { ComponentType } from "@prisma/client";
import rawTemplates from "./templates.json";

/**
 * Government Template Presets
 */
export const GOVERNMENT_TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    components: readonly ComponentType[];
  }
> = rawTemplates as unknown as Record<
  string,
  {
    name: string;
    description: string;
    components: readonly ComponentType[];
  }
>;
