import { describe, it, expect } from "vitest";
import { DummyAudioProvider } from "../dummy";

describe("DummyAudioProvider", () => {
  const provider = new DummyAudioProvider();

  it("extractEmbedding returns embedding with 128 floats and quality ~0.85", async () => {
    const result = await provider.extractEmbedding("https://example.com/audio.wav");
    expect(result.embedding).toHaveLength(128);
    expect(result.embedding.every((v) => typeof v === "number")).toBe(true);
    expect(result.embedding.every((v) => v >= -1 && v <= 1)).toBe(true);
    expect(result.quality).toBe(0.85);
    expect(result.participantId).toBe("");
  });

  it("scoreQuality returns a number between 0.7 and 0.95", async () => {
    const score = await provider.scoreQuality("https://example.com/audio.wav");
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(score).toBeLessThanOrEqual(0.95);
  });

  it("diarize returns segments with 3 clusters", async () => {
    const result = await provider.diarize("https://example.com/media.mp4");
    expect(result.numSpeakers).toBe(3);
    expect(result.segments.length).toBeGreaterThanOrEqual(1);

    const clusterIds = new Set(result.segments.map((s) => s.speakerCluster));
    expect(clusterIds).toContain("cluster_0");
    expect(clusterIds).toContain("cluster_1");
    expect(clusterIds).toContain("cluster_2");

    for (const seg of result.segments) {
      expect(seg.startTime).toBeLessThan(seg.endTime);
      expect(typeof seg.startTime).toBe("number");
      expect(typeof seg.endTime).toBe("number");
    }
  });

  it("transcribe returns segments with text", async () => {
    const result = await provider.transcribe("https://example.com/media.mp4");
    expect(result.language).toBe("en");
    expect(result.duration).toBe(300);
    expect(result.segments.length).toBeGreaterThanOrEqual(1);

    for (const seg of result.segments) {
      expect(typeof seg.text).toBe("string");
      expect(seg.text.length).toBeGreaterThan(0);
      expect(seg.startTime).toBeLessThan(seg.endTime);
      expect(seg.confidence).toBeGreaterThanOrEqual(0.85);
      expect(seg.confidence).toBeLessThanOrEqual(0.99);
    }
  });

  it("matchSpeakers returns results for each cluster", async () => {
    const clusters = [
      { startTime: 0, endTime: 10, speakerCluster: "cluster_0" },
      { startTime: 10, endTime: 20, speakerCluster: "cluster_1" },
      { startTime: 20, endTime: 30, speakerCluster: "cluster_2" },
    ];
    const profiles = [
      { participantId: "p1", embedding: [0.1], quality: 0.9 },
      { participantId: "p2", embedding: [0.2], quality: 0.9 },
    ];

    const results = await provider.matchSpeakers(clusters, profiles);
    expect(results).toHaveLength(3);

    // First two clusters should be mapped to profiles
    expect(results[0].cluster).toBe("cluster_0");
    expect(results[0].participantId).toBe("p1");
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.8);

    expect(results[1].cluster).toBe("cluster_1");
    expect(results[1].participantId).toBe("p2");
    expect(results[1].confidence).toBeGreaterThanOrEqual(0.8);

    // Third cluster has no profile -> null
    expect(results[2].cluster).toBe("cluster_2");
    expect(results[2].participantId).toBeNull();
    expect(results[2].confidence).toBe(0);
  });
});
