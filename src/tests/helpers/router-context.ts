export interface MockAuthContext {
  userId: string | null;
  sessionId?: string | null;
}

export interface MockUser {
  id?: string;
  clerkUserId: string;
  countryId?: string | null;
  role?: {
    name: string;
    level?: number;
  } | null;
  country?: {
    id: string;
    name: string;
    slug: string;
    flag?: string | null;
  } | null;
  [key: string]: any;
}

export interface MockRouterContextOptions {
  auth?: MockAuthContext | null;
  user?: MockUser | null;
  db?: any;
  impersonatorId?: string;
  headers?: Headers;
  sourceIp?: string;
  rateLimitIdentifier?: string;
}

export interface MockRouterContext {
  db: any;
  auth: MockAuthContext | null;
  user: MockUser | null;
  impersonatorId?: string;
  headers: Headers;
  sourceIp: string;
  rateLimitIdentifier: string;
  [key: string]: any;
}

/**
 * Creates a mock tRPC context for characterization and router testing.
 * Defaults to an authenticated DB user with a linked country.
 */
export function createMockRouterContext(options: MockRouterContextOptions = {}): MockRouterContext {
  const defaultAuth: MockAuthContext = {
    userId: "test_user_clerk_id",
    sessionId: "test_session_id",
  };

  const defaultUser: MockUser = {
    id: "user_db_id_1",
    clerkUserId: "test_user_clerk_id",
    countryId: "test_country_1",
    role: {
      name: "member",
      level: 1,
    },
    country: {
      id: "test_country_1",
      name: "Test Country",
      slug: "test-country",
      flag: "https://example.com/flag.png",
    },
  };

  const defaultHeaders = new Headers();
  defaultHeaders.set("x-forwarded-for", "127.0.0.1");

  return {
    db: options.db ?? {},
    auth: options.auth === null ? null : (options.auth ?? defaultAuth),
    user: options.user === null ? null : (options.user ?? defaultUser),
    impersonatorId: options.impersonatorId,
    headers: options.headers ?? defaultHeaders,
    sourceIp: options.sourceIp ?? "127.0.0.1",
    rateLimitIdentifier: options.rateLimitIdentifier ?? "test_user_clerk_id",
  };
}
