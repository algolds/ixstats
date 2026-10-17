/** The callbacks a component hands a tRPC `useMutation`, as the fakes below call them. */
export interface MutationOptions<TData, TInput> {
  onSuccess?: (data: TData, input: TInput) => void;
  onError?: (error: { message: string }) => void;
}

/** A mocked `useMutation` hook, whatever procedure it belongs to. */
interface MockedMutationHook {
  mockImplementation(implementation: never): object;
}

/**
 * Stands in for the server behind a mocked `useMutation` (pass `jest.mocked(api.x.y.useMutation)`): `mutate` records
 * its input, then answers `onSuccess` with what `respond` returns, if `respond` is given. Returns the recorder.
 */
export function fakeMutation<TInput, TData>(
  hook: MockedMutationHook,
  respond?: (input: TInput) => TData
) {
  const mutate = jest.fn<void, [TInput]>();
  hook.mockImplementation(((options: MutationOptions<TData, TInput> = {}) => ({
    mutate: (input: TInput) => {
      mutate(input);
      if (respond) options.onSuccess?.(respond(input), input);
    },
    isPending: false,
  })) as never);
  return mutate;
}

/** A mocked `useMutation` whose every call fails with `message`. */
export function failingMutation(hook: MockedMutationHook, message: string) {
  hook.mockImplementation(((options: MutationOptions<never, never> = {}) => ({
    mutate: () => options.onError?.({ message }),
    isPending: false,
  })) as never);
}
