import { NextRequest, NextResponse } from "next/server";
import { jobRepo } from "@/server/repositories/job.repo";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const jobs = await jobRepo.getJobsBySession(sessionId);
    return NextResponse.json(jobs);
  } catch (err) {
    console.error("Failed to list jobs:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
