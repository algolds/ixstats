import { z } from "zod/v4";

/** Wiki selector shared by every WikiOS reader procedure; defaults to IxWiki. */
export const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");
