import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth/session";
export async function POST(){const response=NextResponse.json({authenticated:false});response.cookies.set(sessionCookieName,"",{httpOnly:true,path:"/",maxAge:0});return response;}
