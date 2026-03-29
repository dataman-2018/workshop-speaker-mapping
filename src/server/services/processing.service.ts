import { prisma } from "@/lib/db/client";
import { ProcessingStatus } from "@prisma/client";
import { getAudioProvider, getSTTProvider } from "@/lib/audio/provider-factory";
import type { SpeakerEmbedding, SpeakerMatchResult } from "@/lib/audio/types";
import type { PyannoteProvider } from "@/lib/audio/providers/pyannote";
import { jobRepo } from "@/server/repositories/job.repo";
import { utteranceRepo } from "@/server/repositories/utterance.repo";

export async function runProcessingPipeline(jobId: string): Promise<void> {
  const provider = getAudioProvider();
  const sttProvider = getSTTProvider();

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

    const participants = session.participants;

    // --- Step 1: ENROLLING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.ENROLLING,
      10,
      "Extracting speaker embeddings"
    );

    const profiles: SpeakerEmbedding[] = [];
    const voiceprints: Array<{
      participantId: string;
      label: string;
      voiceprint: string;
    }> = [];

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

      // For pyannote: extract base64 voiceprint for identify() call
      const vpData = (result as SpeakerEmbedding & { _voiceprint?: string })
        ._voiceprint;
      if (vpData) {
        voiceprints.push({
          participantId: participant.id,
          label: participant.label,
          voiceprint: vpData,
        });
      }

      // Upsert speaker profile in DB
      await prisma.speakerProfile.upsert({
        where: { participantId: participant.id },
        update: {
          embedding: vpData ? { voiceprint: vpData } : result.embedding,
          quality: result.quality,
        },
        create: {
          participantId: participant.id,
          embedding: vpData ? { voiceprint: vpData } : result.embedding,
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

    // Build participant label -> id lookup
    const labelToParticipantId = new Map<string, string>();
    for (const p of participants) {
      labelToParticipantId.set(p.label, p.id);
    }

    // --- Choose pipeline based on provider capabilities ---
    const isPyannote = provider.name === "pyannote" && voiceprints.length > 0;

    let clusterToParticipant: Map<string, string | null>;
    let clusterToConfidence: Map<string, number>;

    if (isPyannote) {
      // === 2-LAYER PIPELINE: pyannote identify (diarization + matching) ===
      await jobRepo.updateJobStatus(
        jobId,
        ProcessingStatus.DIARIZING,
        35,
        "Running speaker identification (diarization + matching)"
      );

      const pyannote = provider as PyannoteProvider;
      const identResult = await pyannote.identify(
        mediaUrl,
        voiceprints.map((vp) => ({
          label: vp.label,
          voiceprint: vp.voiceprint,
        }))
      );

      await jobRepo.updateJobStatus(
        jobId,
        ProcessingStatus.MAPPING,
        55,
        `Identified ${identResult.numSpeakers} speakers, ${identResult.segments.length} segments`
      );

      // Build cluster -> participant lookup from identification results
      // In pyannote identify, speaker is already the matched label or SPEAKER_XX
      clusterToParticipant = new Map();
      clusterToConfidence = new Map();

      const speakersSeen = new Set<string>();
      for (const seg of identResult.segments) {
        if (!speakersSeen.has(seg.speaker)) {
          speakersSeen.add(seg.speaker);
          const participantId =
            labelToParticipantId.get(seg.speaker) ?? null;
          clusterToParticipant.set(seg.speaker, participantId);

          // Get max confidence for matched speaker
          const maxConf = seg.confidence[seg.speaker] ?? 0;
          clusterToConfidence.set(seg.speaker, maxConf / 100); // pyannote uses 0-100
        }
      }

      await jobRepo.updateJobStatus(
        jobId,
        ProcessingStatus.MAPPING,
        65,
        `Mapped ${[...clusterToParticipant.values()].filter(Boolean).length}/${clusterToParticipant.size} speakers`
      );
    } else {
      // === STANDARD PIPELINE: separate diarize + match ===
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

      // --- MAPPING ---
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

      clusterToParticipant = new Map();
      clusterToConfidence = new Map();
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
    }

    // --- Step 4: TRANSCRIBING ---
    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.TRANSCRIBING,
      70,
      "Transcribing audio"
    );

    // Use dedicated STT provider if available, otherwise use main provider
    const transcriber = sttProvider ?? provider;
    const transcriptionResult = await transcriber.transcribe(mediaUrl);

    await jobRepo.updateJobStatus(
      jobId,
      ProcessingStatus.TRANSCRIBING,
      85,
      `Transcribed ${transcriptionResult.segments.length} segments`
    );

    // --- Step 5: Combine and save ---
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
        console.error("Failed to update job status to FAILED:", message);
      });
  }
}
