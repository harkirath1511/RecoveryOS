import { describe,expect,it } from "vitest";
import { isRecoveryTokenUsable } from "./token-lifecycle";
describe("recovery token lifecycle",()=>{it("rejects expired and used tokens",()=>{const now=new Date();expect(isRecoveryTokenUsable({expiresAt:new Date(now.getTime()-1),usedAt:null},now)).toBe(false);expect(isRecoveryTokenUsable({expiresAt:new Date(now.getTime()+1),usedAt:now},now)).toBe(false);});});
