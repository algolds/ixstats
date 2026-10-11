import { z } from "zod";

const exists = z.object({
  data: z.object({ context: z.object({ threadId: z.string().min(1) }) }),
});

/** The existing advert's thread id that a CONFLICT from `createAdvert` carries (`error.data.context.threadId`), else null. */
export function advertThreadIdOf(error: Error): string | null {
  const parsed = exists.safeParse(error);
  return parsed.success ? parsed.data.data.context.threadId : null;
}
