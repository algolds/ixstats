/**
 * A scripted stand-in for MediaWiki's api.php, as a `fetch` replacement: tests never touch a real wiki.
 *
 * It answers the mirror account's login conversation (login token, `action=login`, CSRF token) and hands every
 * other call to the handler the test registered for its `action`. Every request is recorded with its parsed
 * parameters (in the order they were sent, so "the token comes last" can be asserted) and, for a multipart
 * request, the uploaded file.
 */

export interface RecordedFile {
  field: string;
  filename: string;
  type: string;
  content: string;
}

export interface RecordedRequest {
  method: string;
  /** Every field, as sent. */
  params: Record<string, string>;
  /** The field names in the order they were sent. */
  order: string[];
  file: RecordedFile | null;
  cookie: string | null;
  action: string;
}

export type ApiHandler = (request: RecordedRequest) => object | Promise<object>;

export interface FakeMediaWikiOptions {
  /** What `action=login` answers: "Success" (default) or another result, which fails the login. */
  loginResult?: string;
  /** The CSRF token handed out; `+\` is what a session that is not logged in gets. */
  csrfToken?: string;
}

export const API_URL = "http://mediawiki.test/api.php";

export function createFakeMediaWiki(options: FakeMediaWikiOptions = {}) {
  const handlers = new Map<string, ApiHandler>();
  const requests: RecordedRequest[] = [];
  const state = {
    loginResult: options.loginResult ?? "Success",
    csrfToken: options.csrfToken ?? "csrf-token+\\x",
  };

  async function parse(url: string, init: RequestInit | undefined): Promise<RecordedRequest> {
    const params: Record<string, string> = {};
    const order: string[] = [];
    let file: RecordedFile | null = null;
    const put = (key: string, value: string) => {
      params[key] = value;
      order.push(key);
    };
    for (const [key, value] of new URL(url).searchParams) put(key, value);

    const body = init?.body;
    if (body instanceof FormData) {
      for (const [key, value] of body.entries()) {
        if (typeof value === "string") {
          put(key, value);
        } else {
          file = {
            field: key,
            filename: value.name,
            type: value.type,
            content: await value.text(),
          };
          order.push(key);
        }
      }
    } else if (body instanceof URLSearchParams || typeof body === "string") {
      for (const [key, value] of new URLSearchParams(body)) put(key, value);
    }
    const headers = new Headers(init?.headers);
    return {
      method: init?.method ?? "GET",
      params,
      order,
      file,
      cookie: headers.get("Cookie"),
      action: `${params.action ?? ""}${params.meta ? `:${params.meta}` : ""}`,
    };
  }

  /** The answer to a step of the login conversation, or null for any other call. */
  function loginConversation({ params }: RecordedRequest): object | null {
    if (params.action === "query" && params.meta === "tokens" && params.type === "login") {
      return { query: { tokens: { logintoken: "login-token+\\" } } };
    }
    if (params.action === "login") {
      return { login: { result: state.loginResult, reason: "Incorrect password entered." } };
    }
    if (params.action === "query" && params.meta === "tokens" && params.type === "csrf") {
      return { query: { tokens: { csrftoken: state.csrfToken } } };
    }
    return null;
  }

  const fetchMock = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = await parse(String(input), init);
    requests.push(request);
    const handler = handlers.get(request.params.action ?? "");
    const body =
      loginConversation(request) ??
      (await (handler?.(request) ?? {
        error: { code: "notfound", info: `no handler for ${request.action}` },
      }));
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", "wikiSession=abc; path=/; HttpOnly");
    return new Response(JSON.stringify(body), { status: 200, headers });
  });

  return {
    fetch: fetchMock,
    state,
    /** Every request so far. */
    requests,
    /** The requests that are not part of the login conversation. */
    calls: () =>
      requests.filter(
        (request) => !(request.params.meta === "tokens") && request.params.action !== "login"
      ),
    /** Answer `action` with `handler`'s result (an object: a success body, or `{ error: { code, info } }`). */
    on(action: string, handler: ApiHandler) {
      handlers.set(action, handler);
    },
  };
}
