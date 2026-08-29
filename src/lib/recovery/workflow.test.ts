import { describe, expect, it } from "vitest";
import { createWorkflow } from "./workflow";
describe("recovery workflows",()=>{it("does not execute blocked decisions",()=>expect(createWorkflow("w1","j1",{action:"CREATE_PAYMENT_LINK",allowed:false,ruleId:"TERMINAL",reason:"captured"}).status).toBe("STOPPED"));});
