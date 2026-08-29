import { describe, expect, it } from "vitest";
import { verifyQStashSignature } from "./verify";

describe("QStash request verification", () => {
  it("fails closed when a signature or a signing key is missing", async () => {
    await expect(verifyQStashSignature({ body: "{}", signature: null, currentSigningKey: "current", nextSigningKey: "next" })).resolves.toBe(false);
    await expect(verifyQStashSignature({ body: "{}", signature: "signature", currentSigningKey: undefined, nextSigningKey: "next" })).resolves.toBe(false);
  });
});
