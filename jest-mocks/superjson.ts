const superjson = {
  serialize: (value: unknown) => ({ json: value, meta: undefined }),
  deserialize: (payload: { json: unknown }) => payload.json,
};

export default superjson;
