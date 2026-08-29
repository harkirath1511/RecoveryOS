import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
export async function POST(request:Request){try{const {password}=z.object({password:z.string().min(1)}).parse(await request.json());if(!process.env.DEMO_ADMIN_PASSWORD||password!==process.env.DEMO_ADMIN_PASSWORD)return NextResponse.json({authenticated:false},{status:401});const response=NextResponse.json({authenticated:true});response.cookies.set(sessionCookieName,createSessionToken(),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});return response;}catch{return NextResponse.json({authenticated:false},{status:400});}}
