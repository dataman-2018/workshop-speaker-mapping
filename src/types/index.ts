// Domain types shared across the application

export type ProcessingStatus =
  | "pending"
  | "enrolling"
  | "diarizing"
  | "mapping"
  | "transcribing"
  | "completed"
  | "failed";

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface SpeakerLabel {
  participantId: string;
  label: string; // A, B, C, ...
  displayName?: string;
}

export interface Utterance {
  id: string;
  startTime: number; // seconds
  endTime: number;
  text: string;
  speakerLabel: string | null; // null = unknown
  confidence: number; // 0-1
  confidenceLevel: ConfidenceLevel;
  isManuallyEdited: boolean;
}

export interface ProcessingProgress {
  jobId: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  currentStep: string;
  error?: string;
}
