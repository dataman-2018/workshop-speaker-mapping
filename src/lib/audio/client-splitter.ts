/**
 * Client-side audio splitting utility using Web Audio API.
 * Splits a single audio file into segments based on time ranges and returns WAV blobs.
 */

/**
 * Split an audio file into segments based on time ranges.
 * Returns WAV blobs for each segment.
 */
export async function splitAudioFile(
  file: File,
  segments: Array<{ startTime: number; endTime: number }>
): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  return segments.map((segment) => {
    const startSample = Math.floor(segment.startTime * sampleRate);
    const endSample = Math.min(
      Math.floor(segment.endTime * sampleRate),
      audioBuffer.length
    );
    const length = Math.max(0, endSample - startSample);

    // Extract samples for each channel
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const fullChannel = audioBuffer.getChannelData(ch);
      channelData.push(fullChannel.slice(startSample, startSample + length));
    }

    // Interleave channels if stereo, otherwise use mono directly
    let interleaved: Float32Array;
    if (numChannels === 1) {
      interleaved = channelData[0];
    } else {
      interleaved = interleaveChannels(channelData, length);
    }

    const wavBuffer = encodeWAV(interleaved, sampleRate, numChannels);
    return new Blob([wavBuffer], { type: "audio/wav" });
  });
}

/**
 * Interleave multiple channel buffers into a single Float32Array.
 * For stereo: [L0, R0, L1, R1, L2, R2, ...]
 */
function interleaveChannels(
  channelData: Float32Array[],
  length: number
): Float32Array {
  const numChannels = channelData.length;
  const interleaved = new Float32Array(length * numChannels);

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      interleaved[i * numChannels + ch] = channelData[ch][i] ?? 0;
    }
  }

  return interleaved;
}

/**
 * Encode interleaved Float32 samples as a WAV file (PCM 16-bit).
 */
function encodeWAV(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number
): ArrayBuffer {
  const bytesPerSample = 2; // 16-bit PCM
  const dataLength = samples.length * bytesPerSample;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true); // file size - 8
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Convert Float32 samples to Int16 PCM
  let offset = headerLength;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] range then scale to Int16
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += bytesPerSample;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
