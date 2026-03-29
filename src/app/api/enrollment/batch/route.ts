import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const batchEnrollmentSchema = z.object({
  sessionId: z.string().min(1),
  speakers: z
    .array(
      z.object({
        name: z.string().min(1),
        blobUrl: z.string().url(),
        label: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * POST /api/enrollment/batch
 *
 * Batch-create participants and their enrollment samples in one transaction.
 * Used by the bulk enrollment uploader after audio splitting.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = batchEnrollmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, speakers } = parsed.data;

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Count existing participants to determine starting label index
    const existingCount = await prisma.participant.count({
      where: { sessionId },
    });

    // Create participants + enrollment samples in a transaction
    const results = await prisma.$transaction(
      speakers.map((speaker, i) => {
        const labelIndex = existingCount + i;
        const label = indexToLabel(labelIndex);
        const filename = `bulk-enrollment-${label}.wav`;

        return prisma.participant.create({
          data: {
            sessionId,
            label,
            displayName: speaker.name,
            enrollmentSamples: {
              create: {
                blobUrl: speaker.blobUrl,
                filename,
              },
            },
          },
          include: {
            enrollmentSamples: true,
          },
        });
      })
    );

    return NextResponse.json(
      {
        participants: results.map((p) => ({
          id: p.id,
          label: p.label,
          displayName: p.displayName,
          enrollmentSampleId: p.enrollmentSamples[0]?.id,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Batch enrollment error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/** Convert 0-based index to A, B, C, ... Z, AA, AB, ... */
function indexToLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}
