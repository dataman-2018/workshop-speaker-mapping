import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema } from "../project";
import { createSessionSchema, updateSessionSchema } from "../session";
import { createParticipantSchema, updateParticipantSchema } from "../participant";
import {
  initEnrollmentUploadSchema,
  initSessionUploadSchema,
  completeUploadSchema,
} from "../upload";

describe("createProjectSchema", () => {
  it("accepts valid input", () => {
    const result = createProjectSchema.safeParse({ name: "My Project" });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with description", () => {
    const result = createProjectSchema.safeParse({
      name: "My Project",
      description: "A description",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts partial update", () => {
    const result = updateProjectSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createSessionSchema", () => {
  it("accepts valid input", () => {
    const result = createSessionSchema.safeParse({
      name: "Session 1",
      projectId: "proj_123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createSessionSchema.safeParse({ projectId: "proj_123" });
    expect(result.success).toBe(false);
  });

  it("rejects missing projectId", () => {
    const result = createSessionSchema.safeParse({ name: "Session 1" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fields", () => {
    const result = createSessionSchema.safeParse({ name: "", projectId: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateSessionSchema", () => {
  it("accepts valid partial update", () => {
    const result = updateSessionSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });
});

describe("createParticipantSchema", () => {
  it("accepts valid input with sessionId only", () => {
    const result = createParticipantSchema.safeParse({
      sessionId: "sess_123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with displayName", () => {
    const result = createParticipantSchema.safeParse({
      sessionId: "sess_123",
      displayName: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sessionId", () => {
    const result = createParticipantSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("updateParticipantSchema", () => {
  it("accepts displayName", () => {
    const result = updateParticipantSchema.safeParse({ displayName: "Bob" });
    expect(result.success).toBe(true);
  });
});

describe("initEnrollmentUploadSchema", () => {
  it("accepts valid input", () => {
    const result = initEnrollmentUploadSchema.safeParse({
      participantId: "part_1",
      filename: "voice.wav",
      contentType: "audio/wav",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = initEnrollmentUploadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("initSessionUploadSchema", () => {
  it("accepts valid SESSION_AUDIO input", () => {
    const result = initSessionUploadSchema.safeParse({
      sessionId: "sess_1",
      filename: "meeting.mp4",
      contentType: "video/mp4",
      type: "SESSION_AUDIO",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid SESSION_VIDEO input", () => {
    const result = initSessionUploadSchema.safeParse({
      sessionId: "sess_1",
      filename: "meeting.mp4",
      contentType: "video/mp4",
      type: "SESSION_VIDEO",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = initSessionUploadSchema.safeParse({
      sessionId: "sess_1",
      filename: "meeting.mp4",
      contentType: "video/mp4",
      type: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});

describe("completeUploadSchema", () => {
  it("accepts valid input", () => {
    const result = completeUploadSchema.safeParse({
      blobUrl: "https://example.com/blob/123",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("accepts with optional durationSec", () => {
    const result = completeUploadSchema.safeParse({
      blobUrl: "https://example.com/blob/123",
      sizeBytes: 1024,
      durationSec: 60.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = completeUploadSchema.safeParse({
      blobUrl: "not-a-url",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });
});
