import { describe, expect, it } from "vitest";
import { createLinUcbState } from "./linucb";
import { restoreBanditState, serializeBanditState } from "./bandit-persistence";
describe("bandit persistence",()=>{it("round-trips versioned state",()=>{const state=createLinUcbState(["CREATE_PAYMENT_LINK"],3);expect(restoreBanditState(serializeBanditState(state))).toEqual(state);});});
