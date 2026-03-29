import { NextRequest, NextResponse } from "next/server";
import { participantRepo } from "@/server/repositories/participant.repo";
import { createParticipantSchema } from "@/lib/validations/participant";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const participants = await participantRepo.listBySession(sessionId);
    return NextResponse.json(participants);
  } catch (error) {
    console.error("Failed to list participants:", error);
    return NextResponse.json(
      { error: "Failed to list participants" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createParticipantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const participant = await participantRepo.create(parsed.data);
    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("Failed to create participant:", error);
    return NextResponse.json(
      { error: "Failed to create participant" },
      { status: 500 }
    );
  }
}
