import { NextRequest, NextResponse } from "next/server";
import { jobRepo } from "@/server/repositories/job.repo";
import { runProcessingPipeline } from "@/server/services/processing.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const job = await jobRepo.createJob(sessionId);

    // Kick off reprocessing async — don't await
    runProcessingPipeline(job.id).catch((err) => {
      console.error(`Reprocessing pipeline failed for job ${job.id}:`, err);
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error("Failed to start reprocessing:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
