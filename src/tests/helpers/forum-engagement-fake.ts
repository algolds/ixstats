/**
 * Prisma delegates for the engagement tables, empty by default: spread them into a router or module fake so a signed-in
 * read finds no read marks, watches or mentions. Override one with `mockResolvedValue`.
 */
export function engagementTables() {
  return {
    forumThreadRead: {
      findMany: jest.fn(async (_args?: object): Promise<Array<{ threadId: string; readAt: Date }>> => []),
      findUnique: jest.fn(async (_args?: object): Promise<{ readAt: Date } | null> => null),
      createMany: jest.fn(async (_args?: object) => ({ count: 0 })),
      updateMany: jest.fn(async (_args?: object) => ({ count: 0 })),
      upsert: jest.fn(async (_args?: object) => ({})),
    },
    forumReader: {
      findUnique: jest.fn(async (_args?: object): Promise<{ allReadAt: Date } | null> => null),
      upsert: jest.fn(async (_args?: object) => ({})),
    },
    forumThreadWatch: {
      findMany: jest.fn(async (_args?: object): Promise<object[]> => []),
      count: jest.fn(async (_args?: object) => 0),
      createMany: jest.fn(async (_args?: object) => ({ count: 0 })),
      updateMany: jest.fn(async (_args?: object) => ({ count: 0 })),
      deleteMany: jest.fn(async (_args?: object) => ({ count: 0 })),
    },
    forumPostMention: {
      findMany: jest.fn(async (_args?: object): Promise<Array<{ userId: string }>> => []),
      createMany: jest.fn(async (_args?: object) => ({ count: 0 })),
    },
  };
}
