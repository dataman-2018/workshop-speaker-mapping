import type {
  AudioProcessingProvider,
  AudioSegment,
  DiarizationResult,
  SpeakerEmbedding,
  SpeakerMatchResult,
  TranscriptionResult,
} from "../types";

const PYANNOTE_API_BASE = "https://api.pyannote.ai/v1";
const POLL_INTERVAL_MS = 10_000; // 10 seconds as recommended
const MAX_POLL_ATTEMPTS = 360; // 1 hour max

interface PyannoteSegment {
  start: number;
  end: number;
  speaker: string;
  confidence?: Record<string, number>;
  text?: string;
}

interface PyannoteJobResponse {
  jobId: string;
  status: "created" | "pending" | "running" | "succeeded" | "failed" | "canceled";
  output?: {
    voiceprint?: string; // base64 for voiceprint jobs
    segments?: PyannoteSegment[]; // for diarize/identify jobs
  };
  warning?: string;
}

/**
 * pyannoteAI Cloud provider for speaker diarization and identification.
 *
 * Handles:
 * - Voiceprint enrollment (extractEmbedding)
 * - Speaker diarization (diarize)
 * - Speaker identification with voiceprints (identify)
 *
 * Does NOT handle STT — use DeepgramSTTProvider for transcription.
 */
export class PyannoteProvider implements AudioProcessingProvider {
  name = "pyannote";
  private apiKey: string;

  constructor() {
    const key = process.env.PYANNOTE_API_KEY;
    if (!key) {
      throw new Error("PYANNOTE_API_KEY environment variable is required");
    }
    this.apiKey = key;
  }

  /**
   * Create a voiceprint from an enrollment audio sample.
   * Audio must contain only ONE speaker and be <= 30 seconds.
   * Returns the base64-encoded voiceprint as the "embedding".
   */
  async extractEmbedding(audioUrl: string): Promise<SpeakerEmbedding> {
    const response = await this.submitJob("/voiceprint", {
      url: audioUrl,
      model: "precision-2",
    });

    const result = await this.pollUntilComplete(response.jobId);

    if (!result.output?.voiceprint) {
      throw new Error("Voiceprint extraction returned no data");
    }

    // Store the base64 voiceprint as a single-element array for compatibility
    // with the SpeakerEmbedding interface
    return {
      participantId: "", // filled by caller
      embedding: [], // not used — voiceprint stored separately
      quality: 1.0,
      _voiceprint: result.output.voiceprint, // base64 string
    } as SpeakerEmbedding & { _voiceprint: string };
  }

  /**
   * Score audio quality for enrollment.
   * pyannoteAI doesn't have a dedicated quality endpoint,
   * so we attempt voiceprint creation and consider success as high quality.
   */
  async scoreQuality(audioUrl: string): Promise<number> {
    try {
      await this.extractEmbedding(audioUrl);
      return 0.9; // If voiceprint creation succeeds, quality is good
    } catch {
      return 0.3; // Failed — likely bad audio quality or multiple speakers
    }
  }

  /**
   * Run speaker diarization without voiceprint matching.
   */
  async diarize(mediaUrl: string): Promise<DiarizationResult> {
    const response = await this.submitJob("/diarize", {
      url: mediaUrl,
      model: "precision-2",
      confidence: true,
    });

    const result = await this.pollUntilComplete(response.jobId);
    const segments = result.output?.segments ?? [];

    const speakers = new Set(segments.map((s) => s.speaker));

    return {
      segments: segments.map((s) => ({
        startTime: s.start,
        endTime: s.end,
        speakerCluster: s.speaker,
      })),
      numSpeakers: speakers.size,
    };
  }

  /**
   * Run speaker identification: diarization + voiceprint matching in one call.
   * This is the primary method for the Workshop Speaker Mapping use case.
   */
  async identify(
    mediaUrl: string,
    voiceprints: Array<{ label: string; voiceprint: string }>,
    options?: { threshold?: number }
  ): Promise<{
    segments: Array<{
      startTime: number;
      endTime: number;
      speaker: string;
      confidence: Record<string, number>;
    }>;
    numSpeakers: number;
  }> {
    const response = await this.submitJob("/identify", {
      url: mediaUrl,
      voiceprints: voiceprints.map((vp) => ({
        label: vp.label,
        voiceprint: vp.voiceprint,
      })),
      model: "precision-2",
      confidence: true,
      threshold: options?.threshold ?? 50,
    });

    const result = await this.pollUntilComplete(response.jobId);
    const segments = result.output?.segments ?? [];

    const speakers = new Set(segments.map((s) => s.speaker));

    return {
      segments: segments.map((s) => ({
        startTime: s.start,
        endTime: s.end,
        speaker: s.speaker,
        confidence: s.confidence ?? {},
      })),
      numSpeakers: speakers.size,
    };
  }

  /**
   * Transcribe is not supported by pyannoteAI alone.
   * Use DeepgramSTTProvider for transcription.
   */
  async transcribe(): Promise<TranscriptionResult> {
    throw new Error(
      "PyannoteProvider does not support standalone transcription. Use DeepgramSTTProvider."
    );
  }

  /**
   * Match speakers is handled natively by the identify() method.
   * This interface method wraps it for compatibility.
   */
  async matchSpeakers(
    clusters: AudioSegment[],
    profiles: SpeakerEmbedding[]
  ): Promise<SpeakerMatchResult[]> {
    // This method is not used directly in the pyannote flow.
    // The identify() method handles diarization + matching in one call.
    // Return a pass-through for interface compatibility.
    const uniqueClusters = [...new Set(clusters.map((c) => c.speakerCluster))];
    return uniqueClusters.map((cluster) => ({
      cluster,
      participantId: null,
      confidence: 0,
    }));
  }

  // --- Internal helpers ---

  private async submitJob(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<PyannoteJobResponse> {
    const res = await fetch(`${PYANNOTE_API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `pyannoteAI ${endpoint} failed (${res.status}): ${errorText}`
      );
    }

    return res.json();
  }

  private async pollUntilComplete(
    jobId: string
  ): Promise<PyannoteJobResponse> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const res = await fetch(`${PYANNOTE_API_BASE}/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(
          `pyannoteAI job poll failed (${res.status}): ${await res.text()}`
        );
      }

      const job: PyannoteJobResponse = await res.json();

      switch (job.status) {
        case "succeeded":
          return job;
        case "failed":
          throw new Error(`pyannoteAI job ${jobId} failed`);
        case "canceled":
          throw new Error(`pyannoteAI job ${jobId} was canceled`);
        case "created":
        case "pending":
        case "running":
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          break;
      }
    }

    throw new Error(
      `pyannoteAI job ${jobId} timed out after ${MAX_POLL_ATTEMPTS} attempts`
    );
  }
}
