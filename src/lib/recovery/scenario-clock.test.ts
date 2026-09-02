import { describe, expect, it } from "vitest";
import { anchorScenarioClock } from "./scenario-clock";

describe("scenario clock", () => {
  it("keeps virtual order while anchoring deliveries near the present", () => {
    const now = Date.UTC(2026, 7, 31, 12, 0, 0);
    const clock = anchorScenarioClock([{ occurredAt: 0, deliveredAt: 0 }, { occurredAt: 3_600_000, deliveredAt: 3_660_000 }], now);
    expect(clock.endedAt.getTime()).toBe(now);
    expect(clock.startedAt.getTime()).toBe(now - 3_660_000);
    expect(clock.toDate(3_600_000).getTime()).toBe(now - 60_000);
    expect(clock.startedAt.getUTCFullYear()).toBe(2026);
  });
});
