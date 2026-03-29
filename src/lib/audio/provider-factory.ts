import type { AudioProcessingProvider, STTProvider } from "./types";
import { DummyAudioProvider } from "./providers/dummy";
import { PyannoteProvider } from "./providers/pyannote";

/**
 * Get the primary audio processing provider (diarization + speaker identification).
 */
export function getAudioProvider(): AudioProcessingProvider {
  const provider = (process.env.AUDIO_PROVIDER ?? "dummy").trim();

  switch (provider) {
    case "dummy":
      return new DummyAudioProvider();
    case "pyannote":
      return new PyannoteProvider();
    default:
      throw new Error(
        `Unknown audio provider: "${provider}". Supported: dummy, pyannote`
      );
  }
}

/**
 * Get the STT provider for transcription.
 * In 2-layer mode (pyannote + deepgram), this returns the Deepgram provider.
 * In dummy mode, the main provider handles transcription.
 */
export function getSTTProvider(): STTProvider | null {
  const sttProvider = process.env.STT_PROVIDER?.trim();

  if (!sttProvider) return null; // Use main provider's transcribe()

  switch (sttProvider) {
    case "deepgram": {
      // Dynamic import to avoid loading when not needed
      const { DeepgramSTTProvider } = require("./providers/deepgram");
      return new DeepgramSTTProvider();
    }
    default:
      throw new Error(
        `Unknown STT provider: "${sttProvider}". Supported: deepgram`
      );
  }
}
