import type { LinUcbState } from "./linucb";
export function serializeBanditState(state: LinUcbState): string { return JSON.stringify(state); }
export function restoreBanditState(serialized: string): LinUcbState { const value=JSON.parse(serialized) as LinUcbState; if(!value.version||!Number.isInteger(value.featureCount)||!value.actions) throw new Error("Invalid bandit state."); return value; }
