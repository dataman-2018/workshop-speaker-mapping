import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAudioProvider, getSTTProvider } from "@/lib/audio/provider-factory";
import { extractSpeakerNames } from "@/lib/audio/name-extractor";

// Vercel Hobby: max 60s, Pro: max 300s
export const maxDuration = 60;

const analyzeSchema = z.object({
  audioUrl: z.string().min(1),
  sessionId: z.string().min(1),
});

/**
 * POST /api/enrollment/analyze
 *
 * Analyzes a single audio file containing multiple self-introductions.
 * Runs diarization + transcription synchronously (up to 60s).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { audioUrl } = parsed.data;

    const provider = getAudioProvider();
    const sttProvider = getSTTProvider();

    // Step 1: Diarize + Transcribe in parallel
    const [diarizationResult, transcriptionResult] = await Promise.all([
      provider.diarize(audioUrl),
      (sttProvider ?? provider).transcribe(audioUrl),
    ]);

    // Step 2: Merge diarization + transcription
    const mergedSegments = transcriptionResult.segments.map((tSeg) => {
      const midpoint = (tSeg.startTime + tSeg.endTime) / 2;
      const matchingDSeg = diarizationResult.segments.find(
        (dSeg) => dSeg.startTime <= midpoint && dSeg.endTime >= midpoint
      );

      return {
        startTime: tSeg.startTime,
        endTime: tSeg.endTime,
        text: tSeg.text,
        speakerCluster:
          matchingDSeg?.speakerCluster ?? tSeg.speakerCluster ?? "UNKNOWN",
      };
    });

    // Step 3: Extract names
    const speakers = extractSpeakerNames(mergedSegments);

    return NextResponse.json({
      speakers: speakers.map((s, i) => ({
        cluster: s.cluster,
        suggestedName: s.name,
        label: String.fromCharCode(65 + i),
        sourceText: s.sourceText,
        startTime: s.startTime,
        endTime: s.endTime,
        segments: s.segments.map((seg) => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text,
        })),
        bestSegment: pickBestSegment(s.segments),
      })),
      totalDuration: transcriptionResult.duration,
      numSpeakers: diarizationResult.numSpeakers,
    });
  } catch (error) {
    console.error("Enrollment analyze error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

function pickBestSegment(
  segments: Array<{ startTime: number; endTime: number; text: string }>
): { startTime: number; endTime: number } {
  if (segments.length === 0) {
    return { startTime: 0, endTime: 0 };
  }

  const sorted = [...segments].sort(
    (a, b) => b.endTime - b.startTime - (a.endTime - a.startTime)
  );

  const ideal = sorted.find((s) => {
    const dur = s.endTime - s.startTime;
    return dur >= 5 && dur <= 30;
  });

  if (ideal) {
    return { startTime: ideal.startTime, endTime: ideal.endTime };
  }

  const longest = sorted[0];
  const duration = longest.endTime - longest.startTime;

  if (duration > 30) {
    return {
      startTime: longest.startTime,
      endTime: longest.startTime + 30,
    };
  }

  if (duration < 5 && segments.length > 1) {
    return {
      startTime: segments[0].startTime,
      endTime: Math.min(
        segments[segments.length - 1].endTime,
        segments[0].startTime + 30
      ),
    };
  }

  return { startTime: longest.startTime, endTime: longest.endTime };
}
