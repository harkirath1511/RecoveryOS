import { transitionPaymentJourney, type PaymentEventType, type PaymentJourneyState } from "./payment-journey";

export type DurableJourney = { state: PaymentJourneyState; outstandingAmount: number };

export function applyPaymentEvent(journey: DurableJourney, event: PaymentEventType): DurableJourney {
  const transition = transitionPaymentJourney(journey.state, event);
  if (!transition.accepted) return journey;
  return { ...journey, state: transition.state, outstandingAmount: transition.state === "CAPTURED" ? 0 : journey.outstandingAmount };
}
