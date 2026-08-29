import { describe, expect, it } from "vitest";

import { detectPaymentIncident } from "./incident-detector";
import { simulatePaymentAttempts, simulatePaymentEvents } from "./simulator";

describe("payment simulator", () => {
  it("is reproducible for the same seed", () => {
    expect(simulatePaymentAttempts({ seed: 42 })).toEqual(simulatePaymentAttempts({ seed: 42 }));
  });

  it("changes its output when the seed changes", () => {
    expect(simulatePaymentAttempts({ seed: 42 })).not.toEqual(simulatePaymentAttempts({ seed: 43 }));
  });

  it("marks affected current attempts with the degradation timeout", () => {
    const attempts = simulatePaymentAttempts({ seed: 42, currentAttempts: 100 });
    const currentTimeouts = attempts.filter(
      (attempt) => attempt.period === "CURRENT" && attempt.errorCode === "TIMEOUT",
    );

    expect(currentTimeouts.length).toBeGreaterThan(0);
    expect(currentTimeouts.every((attempt) => attempt.provider === "HDFC")).toBe(true);
    expect(currentTimeouts.every((attempt) => attempt.method === "UPI")).toBe(true);
    expect(currentTimeouts.every((attempt) => attempt.device === "ANDROID")).toBe(true);
  });

  it("injects delayed, duplicate, and out-of-order deliveries in virtual time", () => {
    const events = simulatePaymentEvents({ seed: 42, baselineAttempts: 5, currentAttempts: 5, virtualTime: { delayedAuthorizationMs: 10, duplicateEventRate: 1, outOfOrderEventRate: 1 } });
    expect(events.some((event) => event.type === "PAYMENT_AUTHORIZED")).toBe(true);
    expect(events.some((event) => event.duplicate)).toBe(true);
    expect(events.some((event) => event.deliveredAt < event.occurredAt)).toBe(true);
  });
});

describe("incident detector", () => {
  it("detects and ranks the planted degradation segment", () => {
    const incident = detectPaymentIncident(simulatePaymentAttempts({ seed: 42 }));

    expect(incident).not.toBeNull();
    expect(incident?.overallBaseline.successRate).toBeGreaterThan(0.9);
    expect(incident?.overallCurrent.successRate).toBeLessThan(0.8);
    expect(incident?.topSegment.label).toContain("Provider: HDFC");
    expect(incident?.topSegment.label).toContain("Method: UPI");
    expect(incident?.topSegment.label).toContain("Device: ANDROID");
    expect(incident?.topSegment.label).toContain("Error: TIMEOUT");
    expect(incident?.topSegment.excessFailures).toBeGreaterThan(0);
  });

  it("does not open an incident for a tiny cohort", () => {
    const attempts = simulatePaymentAttempts({ baselineAttempts: 10, currentAttempts: 10 });

    expect(detectPaymentIncident(attempts)).toBeNull();
  });
});
