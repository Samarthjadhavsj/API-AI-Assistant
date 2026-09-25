/**
 * Converts a recording to 16 kHz mono 16-bit WAV, which every supported
 * speech-to-text provider accepts (several don't take the recorder's WebM).
 * Three minutes, the longest recording, is about 5.8 MB.
 */

export const WAV_SAMPLE_RATE = 16_000;

/** 16-bit PCM WAV bytes for mono samples in [-1, 1]. */
export function encodeWav(samples: Float32Array, sampleRate = WAV_SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Decodes any browser-playable recording and re-encodes it as 16 kHz mono WAV. */
export async function recordingToWav(blob: Blob): Promise<Blob> {
  if (/^audio\/(wav|x-wav|wave)/i.test(blob.type)) return blob;

  const data = await blob.arrayBuffer();
  const decoder = new OfflineAudioContext(1, 1, WAV_SAMPLE_RATE);
  const decoded = await decoder.decodeAudioData(data);

  const length = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, WAV_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded; // mixed down to mono by the one-channel destination
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return new Blob([encodeWav(rendered.getChannelData(0), WAV_SAMPLE_RATE)], { type: "audio/wav" });
}
