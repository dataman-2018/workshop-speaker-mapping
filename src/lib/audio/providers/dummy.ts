import type {
  AudioProcessingProvider,
  AudioSegment,
  DiarizationResult,
  SpeakerEmbedding,
  SpeakerMatchResult,
  TranscriptionResult,
} from "../types";

const LOREM_PHRASES = [
  "I think that's a really interesting point.",
  "Let me build on what was just said.",
  "So the key takeaway here is alignment.",
  "We should consider the timeline carefully.",
  "From a strategic perspective, this makes sense.",
  "I'd like to push back on that a bit.",
  "Can we circle back to the original question?",
  "The data supports this direction.",
  "We need to involve stakeholders earlier.",
  "That aligns with our Q2 objectives.",
  "Let me share some context on this.",
  "I agree, but with a caveat.",
  "The risk here is underestimating complexity.",
  "Has anyone looked at the competitive landscape?",
  "We should prototype this before committing.",
  "That's a fair concern, let me address it.",
  "The budget implications are significant.",
  "I propose we run a pilot first.",
  "This ties back to our core strategy.",
  "Let's table that and move to next steps.",
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const delay = () => new Promise<void>((r) => setTimeout(r, 500));

export class DummyAudioProvider implements AudioProcessingProvider {
  name = "dummy";

  async extractEmbedding(audioUrl: string): Promise<SpeakerEmbedding> {
    await delay();
    const embedding = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    return {
      participantId: "", // filled in by caller
      embedding,
      quality: 0.85,
    };
  }

  async scoreQuality(_audioUrl: string): Promise<number> {
    await delay();
    return randomBetween(0.7, 0.95);
  }

  async diarize(_mediaUrl: string): Promise<DiarizationResult> {
    await delay();
    const numSegments = Math.floor(randomBetween(10, 21));
    const clusters = ["cluster_0", "cluster_1", "cluster_2"];
    const totalDuration = 300; // 5 minutes
    const avgSegmentDuration = totalDuration / numSegments;

    const segments: AudioSegment[] = [];
    let cursor = 0;

    for (let i = 0; i < numSegments; i++) {
      const duration = randomBetween(
        avgSegmentDuration * 0.5,
        avgSegmentDuration * 1.5
      );
      const gap = randomBetween(0.2, 1.5);
      const startTime = cursor + gap;
      const endTime = Math.min(startTime + duration, totalDuration);

      segments.push({
        startTime: Math.round(startTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        speakerCluster: clusters[i % clusters.length],
      });

      cursor = endTime;
      if (cursor >= totalDuration) break;
    }

    return {
      segments,
      numSpeakers: clusters.length,
    };
  }

  async transcribe(_mediaUrl: string): Promise<TranscriptionResult> {
    await delay();
    const numSegments = Math.floor(randomBetween(10, 21));
    const clusters = ["cluster_0", "cluster_1", "cluster_2"];
    const totalDuration = 300;
    const avgSegmentDuration = totalDuration / numSegments;

    const segments = [];
    let cursor = 0;

    for (let i = 0; i < numSegments; i++) {
      const duration = randomBetween(
        avgSegmentDuration * 0.5,
        avgSegmentDuration * 1.5
      );
      const gap = randomBetween(0.2, 1.5);
      const startTime = cursor + gap;
      const endTime = Math.min(startTime + duration, totalDuration);

      segments.push({
        startTime: Math.round(startTime * 100) / 100,
        endTime: Math.round(endTime * 100) / 100,
        text: LOREM_PHRASES[i % LOREM_PHRASES.length],
        speakerCluster: clusters[i % clusters.length],
        confidence: randomBetween(0.85, 0.99),
      });

      cursor = endTime;
      if (cursor >= totalDuration) break;
    }

    return {
      segments,
      language: "en",
      duration: totalDuration,
    };
  }

  async matchSpeakers(
    clusters: AudioSegment[],
    profiles: SpeakerEmbedding[]
  ): Promise<SpeakerMatchResult[]> {
    await delay();

    // Collect unique cluster IDs
    const uniqueClusters = [...new Set(clusters.map((c) => c.speakerCluster))];

    return uniqueClusters.map((cluster, i) => {
      // If we have a profile for this index, map it; otherwise null (unknown)
      const hasProfile = i < profiles.length;
      return {
        cluster,
        participantId: hasProfile ? profiles[i].participantId : null,
        confidence: hasProfile ? randomBetween(0.8, 0.95) : 0,
      };
    });
  }
}
