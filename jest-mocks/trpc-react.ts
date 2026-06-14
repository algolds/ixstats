/**
 * Mock for ~/trpc/react module
 */

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

const createMockMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  isSuccess: false,
  reset: jest.fn(),
});

const createRouterProxy = (): any => {
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "useQuery") return () => createMockQuery();
        if (prop === "useMutation") return () => createMockMutation();
        if (prop === "useUtils") return () => ({ invalidate: jest.fn() });
        return createRouterProxy();
      },
    }
  );
};

export const api = createRouterProxy();

export const TRPCReactProvider = ({ children }: { children: React.ReactNode }) => children;

export default { api, TRPCReactProvider };
