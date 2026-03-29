import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { utteranceRepo } from "@/server/repositories/utterance.repo";

const UpdateAssignmentSchema = z.object({
  participantId: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ utteranceId: string }> }
) {
  try {
    const { utteranceId } = await params;
    const body = await request.json();
    const parsed = UpdateAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const assignment = await utteranceRepo.updateAssignment(
      utteranceId,
      parsed.data.participantId,
      true // manual correction
    );

    return NextResponse.json(assignment);
  } catch (err) {
    console.error("Failed to update utterance assignment:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
