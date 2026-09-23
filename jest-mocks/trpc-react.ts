/**
 * Mock for ~/trpc/react module
 */

export const createMockQuery = (data: any = null) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({ data }),
  isFetching: false,
  isSuccess: true,
  status: "success" as const,
});

export const createMockMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  isSuccess: false,
  reset: jest.fn(),
});

const createRouterProxy = (): any => {
  const cache: Record<string, any> = {};
  return new Proxy(
    {},
    {
      get: (_target, prop: string | symbol) => {
        if (typeof prop === "symbol" || prop.startsWith("@@") || prop === "then") {
          return undefined;
        }
        if (prop in cache) return cache[prop];

        if (prop === "useQuery") {
          cache[prop] = jest.fn(() => createMockQuery());
          return cache[prop];
        }
        if (prop === "useMutation") {
          cache[prop] = jest.fn(() => createMockMutation());
          return cache[prop];
        }
        if (prop === "useUtils") {
          cache[prop] = jest.fn(() => ({ invalidate: jest.fn() }));
          return cache[prop];
        }

        cache[prop] = createRouterProxy();
        return cache[prop];
      },
    }
  );
};

export const api = createRouterProxy();

export const TRPCReactProvider = ({ children }: { children: React.ReactNode }) => children;

export default { api, TRPCReactProvider };
