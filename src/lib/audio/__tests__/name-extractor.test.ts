import { describe, it, expect } from "vitest";
import { extractSpeakerNames } from "../name-extractor";

describe("extractSpeakerNames", () => {
  it("extracts name from 「〜と申します」 pattern", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 10,
        text: "StoryHubの田中と申します。よろしくお願いします。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("田中");
  });

  it("extracts name from 「私は〜です」 pattern", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 8,
        text: "初めまして、私は鈴木です。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBe("鈴木");
  });

  it("extracts name from 「〜の〜です」 pattern", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 8,
        text: "ABCカンパニーの佐藤です。本日はよろしくお願いします。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBe("佐藤");
  });

  it("extracts English name from 'My name is' pattern", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 5,
        text: "Hello everyone, my name is Tanaka. Nice to meet you.",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBe("Tanaka");
  });

  it("handles multiple speakers", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 10,
        text: "StoryHubの田中と申します。",
        speakerCluster: "SPEAKER_00",
      },
      {
        startTime: 12,
        endTime: 22,
        text: "私は鈴木です。ABC社から来ました。",
        speakerCluster: "SPEAKER_01",
      },
      {
        startTime: 25,
        endTime: 35,
        text: "はい、山田と申します。",
        speakerCluster: "SPEAKER_02",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("田中");
    expect(result[1].name).toBe("鈴木");
    expect(result[2].name).toBe("山田");
  });

  it("returns null name when no pattern matches", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 5,
        text: "よろしくお願いします。今日はいい天気ですね。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBeNull();
  });

  it("sorts speakers by first appearance", () => {
    const segments = [
      {
        startTime: 20,
        endTime: 30,
        text: "鈴木と申します。",
        speakerCluster: "SPEAKER_01",
      },
      {
        startTime: 0,
        endTime: 10,
        text: "田中と申します。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].cluster).toBe("SPEAKER_00");
    expect(result[0].name).toBe("田中");
    expect(result[1].cluster).toBe("SPEAKER_01");
    expect(result[1].name).toBe("鈴木");
  });

  it("uses first few segments for name extraction", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 5,
        text: "こんにちは。",
        speakerCluster: "SPEAKER_00",
      },
      {
        startTime: 5,
        endTime: 10,
        text: "田中と申します。",
        speakerCluster: "SPEAKER_00",
      },
      {
        startTime: 10,
        endTime: 20,
        text: "本日はプレゼンをさせていただきます。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBe("田中");
  });

  it("rejects common non-name words", () => {
    const segments = [
      {
        startTime: 0,
        endTime: 5,
        text: "よろしくと申します。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].name).toBeNull();
  });

  it("includes segment time ranges", () => {
    const segments = [
      {
        startTime: 5,
        endTime: 15,
        text: "田中と申します。",
        speakerCluster: "SPEAKER_00",
      },
      {
        startTime: 20,
        endTime: 30,
        text: "もう少し話します。",
        speakerCluster: "SPEAKER_00",
      },
    ];

    const result = extractSpeakerNames(segments);
    expect(result[0].startTime).toBe(5);
    expect(result[0].endTime).toBe(30);
    expect(result[0].segments).toHaveLength(2);
  });
});
