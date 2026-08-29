import { createHash } from "node:crypto";

export function recoveryTokenDigest(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function isRecoveryTokenUsable(input:{expiresAt:Date;usedAt:Date|null},now=new Date()){return input.usedAt===null&&input.expiresAt.getTime()>now.getTime();}
