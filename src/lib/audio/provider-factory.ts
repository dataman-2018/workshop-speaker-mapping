import type { AudioProcessingProvider } from "./types";
import { DummyAudioProvider } from "./providers/dummy";

export function getAudioProvider(): AudioProcessingProvider {
  const provider = process.env.AUDIO_PROVIDER ?? "dummy";

  switch (provider) {
    case "dummy":
      return new DummyAudioProvider();
    default:
      throw new Error(
        `Unknown audio provider: "${provider}". Supported: dummy`
      );
  }
}
