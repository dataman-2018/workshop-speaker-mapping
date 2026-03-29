import { prisma } from "@/lib/db/client";
import { ProcessingStatus } from "@prisma/client";
import { getAudioProvider } from "@/lib/audio/provider-factory";
import type { SpeakerEmbedding, SpeakerMatchResult } from "@/lib/audio/types";
import { jobRepo } from "@/server/repositories/job.repo";
import { utteranceRepo } from "@/server/repositories/utterance.repo";

export async function runProcessingPipeline(jobId: string): Promise<void> {
  const provider = getAudioProvider();

  try {
    // Load job to get sessionId
    const job = await jobRepo.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const { sessionId } = job;

    // Load session with participants and their enrollment samples
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            enrollmentSamples: { where: { isSelected: true } },
          },
        },
        mediaAssets: {
          where: { type: "SESSION_AUDIO" },
          take: 1,
        },
      },
    });

    const mediaUrl = session.mediaAssets[0]?.blobUrl;
    if (!mediaUrl) throw new Error("No session audio media asset found");

    // --- Step 1: ENROLLING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.ENROLLING,
      10,
      "Extracting speaker embeddings"
    );

    const profiles: SpeakerEmbedding[] = [];
    const participants = session.participants;

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      const samples = participant.enrollmentSamples;

      if (samples.length === 0) continue;

      // Use first selected sample for embedding
      const result = await provider.extractEmbedding(samples[0].blobUrl);
      const profile: SpeakerEmbedding = {
        ...result,
        participantId: participant.id,
      };
      profiles.push(profile);

      // Upsert speaker profile in DB
      await prisma.speakerProfile.upsert({
        where: { participantId: participant.id },
        update: {
          embedding: result.embedding,
          quality: result.quality,
        },
        create: {
          participantId: participant.id,
          embedding: result.embedding,
          quality: result.quality,
        },
      });

      const progress = 10 + Math.round((20 * (i + 1)) / participants.length);
      await jobRepo.updateJobStatus(
        jobId,
        ProcessingStatus.ENROLLING,
        progress,
        `Enrolled ${i + 1}/${participants.length} participants`
      );
    }

    // --- Step 2: DIARIZING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.DIARIZING,
      35,
      "Running speaker diarization"
    );

    const diarizationResult = await provider.diarize(mediaUrl);

    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.DIARIZING,
      50,
      `Found ${diarizationResult.numSpeakers} speakers, ${diarizationResult.segments.length} segments`
    );

    // --- Step 3: MAPPING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.MAPPING,
      55,
      "Matching speakers to enrolled profiles"
    );

    const matchResults: SpeakerMatchResult[] = await provider.matchSpeakers(
      diarizationResult.segments,
      profiles
    );

    // Build cluster -> participantId lookup
    const clusterToParticipant = new Map<string, string | null>();
    const clusterToConfidence = new Map<string, number>();
    for (const match of matchResults) {
      clusterToParticipant.set(match.cluster, match.participantId);
      clusterToConfidence.set(match.cluster, match.confidence);
    }

    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.MAPPING,
      65,
      `Mapped ${matchResults.filter((m) => m.participantId).length}/${matchResults.length} clusters`
    );

    // --- Step 4: TRANSCRIBING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.TRANSCRIBING,
      70,
      "Transcribing audio"
    );

    const transcriptionResult = await provider.transcribe(mediaUrl);

    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.TRANSCRIBING,
      85,
      `Transcribed ${transcriptionResult.segments.length} segments`
    );

    // --- Step 5: Combine and save ---
    // Delete old utterances for reprocessing
    await utteranceRepo.deleteBySession(sessionId);

    const utteranceInputs = transcriptionResult.segments.map((seg) => ({
      startTime: seg.startTime,
      endTime: seg.endTime,
      text: seg.text,
      speakerCluster: seg.speakerCluster,
      confidence: seg.confidence,
      participantId: clusterToParticipant.get(seg.speakerCluster) ?? null,
      matchConfidence: clusterToConfidence.get(seg.speakerCluster) ?? 0,
    }));

    await utteranceRepo.createUtterances(sessionId, utteranceInputs);

    // --- COMPLETED ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.COMPLETED,
      100,
      "Processing complete"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await jobRepo
      .updateJobStatus(jobId, ProcessingStatus.FAILED, undefined, undefined, message)
      .catch(() => {
        // If we can't update the job status, log and move on
        console.error("Failed to update job status to FAILED:", message);
      });
  }
}
