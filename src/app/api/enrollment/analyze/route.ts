import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAudioProvider, getSTTProvider } from "@/lib/audio/provider-factory";
import { extractSpeakerNames } from "@/lib/audio/name-extractor";

const analyzeSchema = z.object({
  audioUrl: z.string().min(1),
  sessionId: z.string().min(1),
});

/**
 * POST /api/enrollment/analyze
 *
 * Analyzes a single audio file containing multiple self-introductions.
 * Returns detected speakers with extracted names and time ranges.
 *
 * Flow:
 * 1. Diarize the audio to find speaker segments
 * 2. Transcribe the audio to get text
 * 3. Extract speaker names from the transcription
 * 4. Return speaker list with names and segment boundaries
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

    // Step 1: Diarize to find speaker segments
    const diarizationResult = await provider.diarize(audioUrl);

    // Step 2: Transcribe to get text
    const transcriber = sttProvider ?? provider;
    const transcriptionResult = await transcriber.transcribe(audioUrl);

    // Step 3: Merge diarization + transcription
    // Map each transcription segment to the closest diarization speaker
    const mergedSegments = transcriptionResult.segments.map((tSeg) => {
      // Find the diarization segment that overlaps most with this transcription segment
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

    // Step 4: Extract names
    const speakers = extractSpeakerNames(mergedSegments);

    return NextResponse.json({
      speakers: speakers.map((s, i) => ({
        cluster: s.cluster,
        suggestedName: s.name,
        label: String.fromCharCode(65 + i), // A, B, C, ...
        sourceText: s.sourceText,
        startTime: s.startTime,
        endTime: s.endTime,
        segments: s.segments.map((seg) => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text,
        })),
        // Best segment for enrollment: longest single-speaker segment
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

/**
 * Pick the best segment for voiceprint enrollment.
 * Prefers segments between 5-30 seconds (pyannoteAI limit).
 */
function pickBestSegment(
  segments: Array<{ startTime: number; endTime: number; text: string }>
): { startTime: number; endTime: number } {
  if (segments.length === 0) {
    return { startTime: 0, endTime: 0 };
  }

  // Sort by duration (longest first)
  const sorted = [...segments].sort(
    (a, b) => b.endTime - b.startTime - (a.endTime - a.startTime)
  );

  // Prefer segments between 5-30 seconds
  const ideal = sorted.find((s) => {
    const dur = s.endTime - s.startTime;
    return dur >= 5 && dur <= 30;
  });

  if (ideal) {
    return { startTime: ideal.startTime, endTime: ideal.endTime };
  }

  // If no ideal segment, use the longest one (capped at 30s)
  const longest = sorted[0];
  const duration = longest.endTime - longest.startTime;

  if (duration > 30) {
    return {
      startTime: longest.startTime,
      endTime: longest.startTime + 30,
    };
  }

  // If all segments are short, combine adjacent ones
  if (duration < 5 && segments.length > 1) {
    const combined = {
      startTime: segments[0].startTime,
      endTime: Math.min(
        segments[segments.length - 1].endTime,
        segments[0].startTime + 30
      ),
    };
    return combined;
  }

  return { startTime: longest.startTime, endTime: longest.endTime };
}
