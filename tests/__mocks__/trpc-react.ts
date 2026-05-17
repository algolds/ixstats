/**
 * Mock for ~/trpc/react module
 * 
 * Provides mock tRPC client hooks for testing without actual API calls.
 */

// Mock query result
const createMockQuery = (data: any = null) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({ data }),
  isFetching: false,
  isSuccess: true,
  status: "success" as const,
});

// Mock mutation result
const createMockMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  isSuccess: false,
  reset: jest.fn(),
});

// Create a proxy that returns mock hooks for any router path
const createRouterProxy = (): any => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "useQuery") {
          return () => createMockQuery();
        }
        if (prop === "useMutation") {
          return () => createMockMutation();
        }
        if (prop === "useUtils") {
          return () => ({
            invalidate: jest.fn(),
          });
        }
        // Nested router access
        return createRouterProxy();
      },
    }
  );
};

export const api = createRouterProxy();

// Provider component (no-op for tests)
export const TRPCReactProvider = ({ children }: { children: React.ReactNode }) => children;

export default { api, TRPCReactProvider };
