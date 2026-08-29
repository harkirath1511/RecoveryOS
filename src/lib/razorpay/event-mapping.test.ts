import { describe, expect, it } from "vitest";
import { mapRazorpayEvent } from "./event-mapping";
describe("Razorpay event mapping", () => { it("maps only supported payment events", () => { expect(mapRazorpayEvent("payment.captured")).toBe("PAYMENT_CAPTURED"); expect(mapRazorpayEvent("payment.dispute.created")).toBeNull(); }); });
