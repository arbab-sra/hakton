import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    hasApiKey: !!process.env.GROQ_API_KEY
  });
}
