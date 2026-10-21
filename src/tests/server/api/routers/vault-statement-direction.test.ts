import { createCallerFactory } from "~/server/api/trpc";
import { vaultStoreRouter } from "~/server/api/routers/vault/store";
import { vaultService } from "~/lib/vault/vault-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";

jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: { getTransactionHistory: jest.fn() },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: { delete: jest.fn().mockResolvedValue(undefined) },
}));

const createCaller = createCallerFactory(vaultStoreRouter);
const history = jest.mocked(vaultService.getTransactionHistory);
describe("vault.getTransactions direction", () => {
  const caller = () => createCaller(createMockRouterContext({ db: {} }) as never);

  beforeEach(() => history.mockReset());
  it("rejects an unknown direction", async () => {
    await expect(caller().getTransactions({ direction: "sideways" } as never)).rejects.toThrow();
  });
});
