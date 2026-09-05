import { describe, expect, it } from "vitest";
import { incidentPaymentFilters } from "./incident-payment-filters";

describe("incidentPaymentFilters", () => {
  it.each([
    ["provider:Razorpay", { provider: "Razorpay" }],
    ["method:UPI", { method: "UPI" }],
    ["device:MOBILE", { device: "MOBILE" }],
    ["error:PAYMENT_FAILED", { query: "PAYMENT_FAILED" }],
    ["provider-method:Razorpay|UPI", { provider: "Razorpay", method: "UPI" }],
    ["provider-error:Razorpay|BAD_REQUEST", { provider: "Razorpay", query: "BAD_REQUEST" }],
    ["provider-method-device:Razorpay|CARD|DESKTOP", { provider: "Razorpay", method: "CARD", device: "DESKTOP" }],
  ])("maps %s into supported payment filters", (cohort, expected) => {
    expect(incidentPaymentFilters(cohort)).toEqual(expected);
  });

  it("does not fabricate a filter for an unknown cohort", () => {
    expect(incidentPaymentFilters("unknown:value")).toEqual({});
  });
});
