import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jobRepo } from "@/server/repositories/job.repo";
import { runProcessingPipeline } from "@/server/services/processing.service";

const StartJobSchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = StartJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId } = parsed.data;
    const job = await jobRepo.createJob(sessionId);

    // Kick off processing async — don't await
    runProcessingPipeline(job.id).catch((err) => {
      console.error(`Processing pipeline failed for job ${job.id}:`, err);
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error("Failed to start job:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
