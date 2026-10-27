import { z } from "zod";

const exists = z.object({
  data: z.object({ context: z.object({ threadId: z.string().min(1) }) }),
});

/** The existing advert's thread id that a CONFLICT from `createAdvert` carries (`error.data.context.threadId`), else null. */
export function advertThreadIdOf(error: Error): string | null {
  const parsed = exists.safeParse(error);
  return parsed.success ? parsed.data.data.context.threadId : null;
}

const conflict = z.object({ data: z.object({ code: z.literal("CONFLICT") }) });

/** Whether `createAdvert` refused with a CONFLICT (the realm has an advert, or a moderator hid it; an archived realm too). */
export function isAdvertConflict(error: Error): boolean {
  return conflict.safeParse(error).success;
}
