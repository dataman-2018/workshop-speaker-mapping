import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessingStatus } from "@prisma/client";

// Use vi.hoisted so mock objects are available before vi.mock factories run
const { mockJobRepo, mockUtteranceRepo, mockProvider, mockPrisma } = vi.hoisted(() => ({
  mockJobRepo: {
    getJob: vi.fn(),
    updateJobStatus: vi.fn(),
  },
  mockUtteranceRepo: {
    deleteBySession: vi.fn(),
    createUtterances: vi.fn(),
  },
  mockProvider: {
    name: "dummy",
    extractEmbedding: vi.fn(),
    scoreQuality: vi.fn(),
    diarize: vi.fn(),
    transcribe: vi.fn(),
    matchSpeakers: vi.fn(),
  },
  mockPrisma: {
    session: {
      findUniqueOrThrow: vi.fn(),
    },
    speakerProfile: {
      upsert: vi.fn(),
    },
    transcriptUtterance: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/audio/provider-factory", () => ({
  getAudioProvider: () => mockProvider,
}));

vi.mock("@/server/repositories/job.repo", () => ({
  jobRepo: mockJobRepo,
}));

vi.mock("@/server/repositories/utterance.repo", () => ({
  utteranceRepo: mockUtteranceRepo,
}));

// Import after mocks
import { runProcessingPipeline } from "../processing.service";

describe("runProcessingPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockJobRepo.getJob.mockResolvedValue({
      id: "job_1",
      sessionId: "sess_1",
    });

    mockJobRepo.updateJobStatus.mockResolvedValue({});

    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({
      id: "sess_1",
      participants: [
        {
          id: "p1",
          enrollmentSamples: [{ blobUrl: "https://example.com/sample1.wav", isSelected: true }],
        },
      ],
      mediaAssets: [{ blobUrl: "https://example.com/session.mp4", type: "SESSION_AUDIO" }],
    });

    mockPrisma.speakerProfile.upsert.mockResolvedValue({});

    mockProvider.extractEmbedding.mockResolvedValue({
      participantId: "",
      embedding: Array(128).fill(0.5),
      quality: 0.85,
    });

    mockProvider.diarize.mockResolvedValue({
      segments: [
        { startTime: 0, endTime: 10, speakerCluster: "cluster_0" },
        { startTime: 10, endTime: 20, speakerCluster: "cluster_1" },
      ],
      numSpeakers: 2,
    });

    mockProvider.matchSpeakers.mockResolvedValue([
      { cluster: "cluster_0", participantId: "p1", confidence: 0.9 },
      { cluster: "cluster_1", participantId: null, confidence: 0 },
    ]);

    mockProvider.transcribe.mockResolvedValue({
      segments: [
        {
          startTime: 0,
          endTime: 10,
          text: "Hello world",
          speakerCluster: "cluster_0",
          confidence: 0.95,
        },
      ],
      language: "en",
      duration: 300,
    });

    mockUtteranceRepo.deleteBySession.mockResolvedValue({});
    mockUtteranceRepo.createUtterances.mockResolvedValue([]);
  });

  it("orchestrates the correct sequence of calls", async () => {
    await runProcessingPipeline("job_1");

    expect(mockJobRepo.getJob).toHaveBeenCalledWith("job_1");

    expect(mockPrisma.session.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sess_1" } })
    );

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.ENROLLING,
      10,
      "Extracting speaker embeddings"
    );
    expect(mockProvider.extractEmbedding).toHaveBeenCalledWith(
      "https://example.com/sample1.wav"
    );
    expect(mockPrisma.speakerProfile.upsert).toHaveBeenCalled();

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.DIARIZING,
      35,
      "Running speaker diarization"
    );
    expect(mockProvider.diarize).toHaveBeenCalledWith(
      "https://example.com/session.mp4"
    );

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.MAPPING,
      55,
      "Matching speakers to enrolled profiles"
    );
    expect(mockProvider.matchSpeakers).toHaveBeenCalled();

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.TRANSCRIBING,
      70,
      "Transcribing audio"
    );
    expect(mockProvider.transcribe).toHaveBeenCalledWith(
      "https://example.com/session.mp4"
    );

    expect(mockUtteranceRepo.deleteBySession).toHaveBeenCalledWith("sess_1");
    expect(mockUtteranceRepo.createUtterances).toHaveBeenCalledWith(
      "sess_1",
      expect.arrayContaining([
        expect.objectContaining({
          text: "Hello world",
          participantId: "p1",
        }),
      ])
    );

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.COMPLETED,
      100,
      "Processing complete"
    );
  });

  it("marks job as FAILED when an error occurs", async () => {
    mockJobRepo.getJob.mockRejectedValue(new Error("DB connection failed"));

    await runProcessingPipeline("job_1");

    expect(mockJobRepo.updateJobStatus).toHaveBeenCalledWith(
      "job_1",
      ProcessingStatus.FAILED,
      undefined,
      undefined,
      "DB connection failed"
    );
  });

  it("handles failure to update job status on error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockJobRepo.getJob.mockRejectedValue(new Error("DB connection failed"));
    mockJobRepo.updateJobStatus.mockRejectedValue(new Error("Update also failed"));

    await runProcessingPipeline("job_1");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to update job status to FAILED:",
      "DB connection failed"
    );

    consoleSpy.mockRestore();
  });

  it("skips participants without enrollment samples", async () => {
    mockPrisma.session.findUniqueOrThrow.mockResolvedValue({
      id: "sess_1",
      participants: [
        { id: "p1", enrollmentSamples: [] },
        {
          id: "p2",
          enrollmentSamples: [{ blobUrl: "https://example.com/s2.wav", isSelected: true }],
        },
      ],
      mediaAssets: [{ blobUrl: "https://example.com/session.mp4", type: "SESSION_AUDIO" }],
    });

    await runProcessingPipeline("job_1");

    expect(mockProvider.extractEmbedding).toHaveBeenCalledTimes(1);
    expect(mockProvider.extractEmbedding).toHaveBeenCalledWith(
      "https://example.com/s2.wav"
    );
  });
});
