type VirtualEvent = { occurredAt: number; deliveredAt: number };

export function anchorScenarioClock(events: readonly VirtualEvent[], now = Date.now()) {
  if (!events.length) throw new Error("A scenario requires at least one virtual event.");
  const latestDelivery = Math.max(...events.map(event => event.deliveredAt));
  const earliestOccurrence = Math.min(...events.map(event => event.occurredAt));
  const anchor = now - latestDelivery;
  return {
    toDate: (virtualTime: number) => new Date(anchor + virtualTime),
    startedAt: new Date(anchor + earliestOccurrence),
    endedAt: new Date(anchor + latestDelivery),
  };
}
