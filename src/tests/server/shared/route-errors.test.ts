/** @jest-environment node */
import { describe, expect, it, jest } from "@jest/globals";
import { internalErrorResponse } from "~/server/shared/route-errors";

describe("internalErrorResponse", () => {
  it("returns a fixed message and an 8-char errorId without leaking error text", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const secretError = new Error("SELECT * FROM secret_table WHERE key='top_secret_123'");

    const response = internalErrorResponse("TestScope", secretError);
    const body = (await response.json()) as {
      success: boolean;
      error: string;
      errorId: string;
    };

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Something went wrong");
    expect(body.errorId).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(body)).not.toContain("secret_table");
    expect(JSON.stringify(body)).not.toContain("top_secret_123");
    expect(spy).toHaveBeenCalledWith(`[TestScope] ${body.errorId}`, secretError);

    spy.mockRestore();
  });
});
