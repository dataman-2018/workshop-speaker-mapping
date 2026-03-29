import { NextRequest, NextResponse } from "next/server";
import { utteranceRepo } from "@/server/repositories/utterance.repo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const utterances = await utteranceRepo.getBySession(sessionId);
    return NextResponse.json(utterances);
  } catch (err) {
    console.error("Failed to get transcript:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
