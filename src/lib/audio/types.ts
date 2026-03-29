// Audio processing provider interface (adapter pattern)

export interface AudioSegment {
  startTime: number;
  endTime: number;
  speakerCluster: string; // provider-assigned cluster ID
}

export interface SpeakerEmbedding {
  participantId: string;
  embedding: number[];
  quality: number; // 0-1
}

export interface DiarizationResult {
  segments: AudioSegment[];
  numSpeakers: number;
}

export interface TranscriptionSegment {
  startTime: number;
  endTime: number;
  text: string;
  speakerCluster: string;
  confidence: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

export interface SpeakerMatchResult {
  cluster: string;
  participantId: string | null; // null = unknown
  confidence: number;
}

/**
 * Provider interface for audio processing.
 * Implement this to add support for a new audio API (Deepgram, AssemblyAI, Azure, etc.)
 */
export interface AudioProcessingProvider {
  name: string;

  /** Extract speaker embedding from an enrollment audio sample */
  extractEmbedding(audioUrl: string): Promise<SpeakerEmbedding>;

  /** Score quality of an audio sample for enrollment */
  scoreQuality(audioUrl: string): Promise<number>;

  /** Run speaker diarization on a media file */
  diarize(mediaUrl: string): Promise<DiarizationResult>;

  /** Transcribe a media file with speaker labels */
  transcribe(mediaUrl: string): Promise<TranscriptionResult>;

  /** Match diarization clusters to enrolled speaker profiles */
  matchSpeakers(
    clusters: AudioSegment[],
    profiles: SpeakerEmbedding[]
  ): Promise<SpeakerMatchResult[]>;
}
