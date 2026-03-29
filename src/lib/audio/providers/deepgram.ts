import type { TranscriptionResult, TranscriptionSegment } from "@/lib/audio/types";

// ── Deepgram REST API response types ──────────────────────────────

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramUtterance {
  start: number;
  end: number;
  transcript: string;
  confidence: number;
  speaker: number;
  channel: number;
}

interface DeepgramMetadata {
  duration: number;
  channels: number;
}

interface DeepgramResponse {
  results: {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
  metadata: DeepgramMetadata;
}

// ── Provider ──────────────────────────────────────────────────────

/**
 * Deepgram Nova-3 STT provider for Japanese transcription.
 *
 * This provider only handles transcription (STT). Diarization and speaker
 * identification are handled by a separate pyannoteAI layer.
 */
export class DeepgramSTTProvider {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.deepgram.com/v1/listen";

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.DEEPGRAM_API_KEY;
    if (!key) {
      throw new Error(
        "Deepgram API key is required. Set DEEPGRAM_API_KEY in your environment or pass it to the constructor."
      );
    }
    this.apiKey = key;
  }

  /**
   * Transcribe a pre-recorded audio file via URL using Deepgram Nova-3.
   */
  async transcribe(mediaUrl: string): Promise<TranscriptionResult> {
    const params = new URLSearchParams({
      model: "nova-3",
      language: "ja",
      punctuate: "true",
      utterances: "true",
      smart_format: "true",
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: mediaUrl }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Deepgram API error (${response.status} ${response.statusText}): ${body}`
      );
    }

    const data: DeepgramResponse = await response.json();

    return this.mapResponse(data);
  }

  // ── Private helpers ───────────────────────────────────────────

  private mapResponse(data: DeepgramResponse): TranscriptionResult {
    const utterances = data.results.utterances;

    if (!utterances || utterances.length === 0) {
      return {
        segments: [],
        language: "ja",
        duration: data.metadata.duration,
      };
    }

    const segments: TranscriptionSegment[] = utterances.map((u) => ({
      startTime: u.start,
      endTime: u.end,
      text: u.transcript,
      speakerCluster: `SPEAKER_${String(u.speaker).padStart(2, "0")}`,
      confidence: u.confidence,
    }));

    return {
      segments,
      language: "ja",
      duration: data.metadata.duration,
    };
  }
}
