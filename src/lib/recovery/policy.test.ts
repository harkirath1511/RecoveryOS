import { describe, expect, it } from "vitest";
import { createLinUcbState, rankLinUcbActions, updateLinUcb } from "./linucb";
import { encodeRecoveryContext, type RecoveryPolicyContext } from "./policy-context";
import { chooseRulesAction } from "./rules-policy";

const context: RecoveryPolicyContext = {
  amount: 500_000,
  attemptNumber: 1,
  minutesSinceFailure: 2,
  hourOfDay: 14,
  method: "UPI",
  provider: "HDFC",
  errorCode: "PAYMENT_FAILED",
  device: "ANDROID",
  activeIncident: false,
  downtimeSeverity: 0,
};

describe("rules recovery policy", () => {
  it("prefers verification for timeout incidents", () => {
    const decision = chooseRulesAction(
      { ...context, errorCode: "TIMEOUT", activeIncident: true },
      ["WAIT_AND_VERIFY", "OFFER_ALTERNATE_CHECKOUT"],
    );
    expect(decision.action).toBe("WAIT_AND_VERIFY");
  });

  it("never returns an action excluded by safety", () => {
    const decision = chooseRulesAction(context, ["MANUAL_REVIEW"]);
    expect(decision.action).toBe("MANUAL_REVIEW");
  });
});

describe("LinUCB", () => {
  it("learns from attributable captures", () => {
    const features = encodeRecoveryContext(context);
    let state = createLinUcbState(["RETRY_ORIGINAL_CHECKOUT", "CREATE_PAYMENT_LINK"], features.length);
    state = updateLinUcb(state, "CREATE_PAYMENT_LINK", features, true);
    state = updateLinUcb(state, "CREATE_PAYMENT_LINK", features, true);

    const ranking = rankLinUcbActions(
      state,
      features,
      ["RETRY_ORIGINAL_CHECKOUT", "CREATE_PAYMENT_LINK"],
      context.amount,
      0,
    );
    expect(ranking[0]?.action).toBe("CREATE_PAYMENT_LINK");
    expect(ranking[0]?.expectedRecoveryAmount).toBeGreaterThan(0);
  });

  it("cannot rank a prohibited action", () => {
    const features = encodeRecoveryContext(context);
    const state = createLinUcbState(["RETRY_ORIGINAL_CHECKOUT", "CREATE_PAYMENT_LINK"], features.length);
    const ranking = rankLinUcbActions(state, features, ["CREATE_PAYMENT_LINK"], context.amount);
    expect(ranking).toHaveLength(1);
    expect(ranking[0]?.action).toBe("CREATE_PAYMENT_LINK");
  });

  it("deducts intervention cost as currency from expected recovered value", () => {
    const features = encodeRecoveryContext(context);
    let state = createLinUcbState(["CREATE_PAYMENT_LINK"], features.length);
    state = updateLinUcb(state, "CREATE_PAYMENT_LINK", features, true);
    const [ranking] = rankLinUcbActions(state, features, ["CREATE_PAYMENT_LINK"], context.amount, 0, { CREATE_PAYMENT_LINK: 10_000 });
    expect(ranking?.expectedRecoveryAmount).toBeLessThan(Math.round((ranking?.predictedSuccess ?? 0) * context.amount));
  });

  it("uses explicit other features for unknown categories", () => {
    const features = encodeRecoveryContext({ ...context, provider: "UNSEEN_BANK" });
    expect(features).toContain(1);
    expect(features.every(Number.isFinite)).toBe(true);
  });

  it("rejects a feature schema mismatch", () => {
    const state = createLinUcbState(["CREATE_PAYMENT_LINK"], 2);
    expect(() => rankLinUcbActions(state, [1], ["CREATE_PAYMENT_LINK"], context.amount)).toThrow("Expected 2 features");
  });
});
