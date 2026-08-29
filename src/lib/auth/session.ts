import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
const cookieName="recoveryos_session";
function signature(value:string){const secret=process.env.SESSION_SECRET;if(!secret)throw new Error("SESSION_SECRET is not configured.");return createHmac("sha256",secret).update(value).digest("hex");}
export function createSessionToken(){const value="operator";return `${value}.${signature(value)}`;}
export function verifySessionToken(token:string|undefined){if(!token)return false;const [value,provided]=token.split(".");if(value!=="operator"||!provided)return false;const expected=signature(value);return provided.length===expected.length&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));}
export const sessionCookieName=cookieName;
export async function requireOperator(){const token=(await cookies()).get(cookieName)?.value;if(!verifySessionToken(token))return NextResponse.json({error:"Operator authentication required."},{status:401});return null;}
