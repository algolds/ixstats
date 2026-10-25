/**
 * What the browser receives when a procedure fails: the request goes through tRPC's fetch handler, so the error
 * formatter (`src/server/api/trpc/init.ts`) has turned a thrown `AppError` (such as `WikiUnavailableError`) into its
 * code and status, exactly as the client reads them. `createCaller` skips the formatter, so it cannot show this.
 */
import type { AnyTRPCRouter } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export interface ClientError {
  status: number;
  code: string;
  message: string;
}

interface ErrorBody {
  error?: { json: { message: string; data: { code: string } } };
}

/** The error a GET of the query `path` with `input` answers, as the client sees it; throws when the query succeeds. */
export async function clientErrorOf(
  router: AnyTRPCRouter,
  path: string,
  input: object,
  ctx: object
): Promise<ClientError> {
  // superjson's wire form of plain JSON values: `{ json }` with no meta.
  const query = encodeURIComponent(JSON.stringify({ json: input }));
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${path}?input=${query}`),
    router,
    createContext: async () => ctx as never,
  });
  const body = (await response.json()) as ErrorBody;
  if (!body.error) throw new Error(`${path} answered ${response.status} with no error`);
  return {
    status: response.status,
    code: body.error.json.data.code,
    message: body.error.json.message,
  };
}
