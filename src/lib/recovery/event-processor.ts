import { transitionPaymentJourney, type PaymentEventType, type PaymentJourneyState } from "./payment-journey";

export type StoredJourney = { id: string; state: PaymentJourneyState; processedEventIds: readonly string[] };
export type ProcessedWebhookEvent = { id: string; paymentEvent: PaymentEventType };
export type EventProcessResult = { journey: StoredJourney; duplicate: boolean; accepted: boolean; reason: string };

export function processVerifiedEvent(journey: StoredJourney, event: ProcessedWebhookEvent): EventProcessResult {
  if (journey.processedEventIds.includes(event.id)) return { journey, duplicate: true, accepted: false, reason: "Duplicate verified event ignored." };
  const transition = transitionPaymentJourney(journey.state, event.paymentEvent);
  return {
    journey: { ...journey, state: transition.state, processedEventIds: [...journey.processedEventIds, event.id] },
    duplicate: false,
    accepted: transition.accepted,
    reason: transition.reason,
  };
}
