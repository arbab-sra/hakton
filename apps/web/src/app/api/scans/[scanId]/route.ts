import { NextResponse } from "next/server";

import { getDatabase } from "@codemri/db";
import { getScanProgressForActor } from "@codemri/repository";

import { getAuthenticatedActor } from "@/lib/actor";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { scanId } = await params;
  const scan = await getScanProgressForActor(getDatabase().database, scanId, actor.email);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json({ scan });
}
