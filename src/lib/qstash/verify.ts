import { Receiver } from "@upstash/qstash";

export async function verifyQStashSignature(input: {
  body: string;
  signature: string | null;
  currentSigningKey: string | undefined;
  nextSigningKey: string | undefined;
}): Promise<boolean> {
  if (!input.signature || !input.currentSigningKey || !input.nextSigningKey) return false;
  return new Receiver({ currentSigningKey: input.currentSigningKey, nextSigningKey: input.nextSigningKey }).verify({ body: input.body, signature: input.signature });
}
