import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const validationSchema = z.object({
  provider: z.literal("groq"),
  model: z.enum(["openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"]),
  apiKey: z.string().trim().min(1).max(1_024)
});

export async function POST(request: Request) {
  try {
    const { model, apiKey } = validationSchema.parse(await request.json());
    const response = await fetch(
      `https://api.groq.com/openai/v1/models/${encodeURIComponent(model)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000)
      }
    );

    if (response.status === 401) {
      return NextResponse.json({ error: "Groq rejected that API key." }, { status: 400 });
    }
    if (response.status === 404) {
      return NextResponse.json(
        { error: "This Groq account cannot access the selected model." },
        { status: 400 }
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: "Groq could not validate the selected model right now." },
        { status: 503 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Choose a valid Groq model and API key." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to reach Groq. Check your connection and try again." },
      { status: 503 }
    );
  }
}
