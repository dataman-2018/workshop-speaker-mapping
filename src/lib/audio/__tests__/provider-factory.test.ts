import { describe, it, expect, afterEach, vi } from "vitest";
import { getAudioProvider } from "../provider-factory";
import { DummyAudioProvider } from "../providers/dummy";

describe("getAudioProvider", () => {
  const originalEnv = process.env.AUDIO_PROVIDER;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUDIO_PROVIDER;
    } else {
      process.env.AUDIO_PROVIDER = originalEnv;
    }
  });

  it("returns DummyAudioProvider when AUDIO_PROVIDER=dummy", () => {
    process.env.AUDIO_PROVIDER = "dummy";
    const provider = getAudioProvider();
    expect(provider).toBeInstanceOf(DummyAudioProvider);
    expect(provider.name).toBe("dummy");
  });

  it("returns DummyAudioProvider when AUDIO_PROVIDER is undefined", () => {
    delete process.env.AUDIO_PROVIDER;
    const provider = getAudioProvider();
    expect(provider).toBeInstanceOf(DummyAudioProvider);
  });

  it("throws for unknown provider", () => {
    process.env.AUDIO_PROVIDER = "nonexistent";
    expect(() => getAudioProvider()).toThrowError(
      'Unknown audio provider: "nonexistent". Supported: dummy'
    );
  });
});
