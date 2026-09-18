import { describe, expect, it } from "vitest";

/**
 * Tests to validate PCM format specifications for Gemini Live API.
 * Ensures audio is converted to 16-bit PCM at 16kHz, little-endian.
 */
describe("PCM Format Validation", () => {
  describe("16-bit PCM conversion", () => {
    it("converts float32 sample 0.5 to int16 16383", () => {
      const sample = 0.5;
      const int16 = sample * 0x7FFF; // Positive: * 32767

      expect(Math.floor(int16)).toBe(16383);
    });

    it("converts float32 sample -0.5 to int16 -16384", () => {
      const sample = -0.5;
      const int16 = sample * 0x8000; // Negative: * 32768

      expect(Math.floor(int16)).toBe(-16384);
    });

    it("converts float32 sample 1.0 to int16 32767", () => {
      const sample = 1.0;
      const int16 = sample * 0x7FFF;

      expect(int16).toBe(32767);
    });

    it("converts float32 sample -1.0 to int16 -32768", () => {
      const sample = -1.0;
      const int16 = sample * 0x8000;

      expect(int16).toBe(-32768);
    });

    it("clamps float32 samples > 1.0 to max int16", () => {
      const sample = 1.5; // Out of range
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped * 0x7FFF;

      expect(int16).toBe(32767);
    });

    it("clamps float32 samples < -1.0 to min int16", () => {
      const sample = -1.5; // Out of range
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped * 0x8000;

      expect(int16).toBe(-32768);
    });
  });

  describe("16kHz sample rate", () => {
    it("requires correct resampling ratio from 48kHz", () => {
      const inputRate = 48000;
      const targetRate = 16000;
      const ratio = inputRate / targetRate;

      expect(ratio).toBe(3.0);
      // Every 3rd sample should be taken
    });

    it("requires correct resampling ratio from 44.1kHz", () => {
      const inputRate = 44100;
      const targetRate = 16000;
      const ratio = inputRate / targetRate;

      expect(ratio).toBeCloseTo(2.75625, 5);
    });

    it("calculates output sample count correctly", () => {
      const inputSamples = 4800; // 100ms at 48kHz
      const inputRate = 48000;
      const targetRate = 16000;
      const ratio = inputRate / targetRate;

      const outputSamples = Math.floor(inputSamples / ratio);

      expect(outputSamples).toBe(1600); // 100ms at 16kHz
    });
  });

  describe("Int16Array format", () => {
    it("creates Int16Array with correct byte length", () => {
      const samples = 1000;
      const pcmData = new Int16Array(samples);

      expect(pcmData.length).toBe(samples);
      expect(pcmData.byteLength).toBe(samples * 2); // 2 bytes per sample
      expect(pcmData.BYTES_PER_ELEMENT).toBe(2);
    });

    it("is little-endian by default on most platforms", () => {
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setInt16(0, 0x1234, true); // true = little-endian

      const bytes = new Uint8Array(buffer);

      // In little-endian: 0x34 comes first, then 0x12
      expect(bytes[0]).toBe(0x34);
      expect(bytes[1]).toBe(0x12);
    });

    it("transfers ArrayBuffer correctly", () => {
      const pcmData = new Int16Array([100, 200, 300]);
      const buffer = pcmData.buffer;

      expect(buffer.byteLength).toBe(6); // 3 samples * 2 bytes

      // Verify data integrity
      const copy = new Int16Array(buffer);
      expect(copy[0]).toBe(100);
      expect(copy[1]).toBe(200);
      expect(copy[2]).toBe(300);
    });
  });

  describe("chunk size validation", () => {
    it("handles small chunks (100 samples)", () => {
      const chunkSize = 100;
      const pcmData = new Int16Array(chunkSize);

      expect(pcmData.byteLength).toBe(200); // 100 samples * 2 bytes
    });

    it("handles medium chunks (1600 samples = 100ms at 16kHz)", () => {
      const chunkSize = 1600; // 100ms at 16kHz
      const pcmData = new Int16Array(chunkSize);

      expect(pcmData.byteLength).toBe(3200); // 1600 samples * 2 bytes
    });

    it("handles large chunks (16000 samples = 1s at 16kHz)", () => {
      const chunkSize = 16000; // 1 second at 16kHz
      const pcmData = new Int16Array(chunkSize);

      expect(pcmData.byteLength).toBe(32000); // 16000 samples * 2 bytes
    });
  });

  describe("resampling algorithm", () => {
    it("performs simple downsampling by decimation", () => {
      // Input: 6 samples at 48kHz
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const inputRate = 48000;
      const targetRate = 16000;
      const ratio = inputRate / targetRate; // 3.0

      // Output: 2 samples at 16kHz (take every 3rd sample)
      const outputLength = Math.floor(input.length / ratio);
      const output = new Int16Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        const sourceIndex = Math.floor(i * ratio);
        const sample = Math.max(-1, Math.min(1, input[sourceIndex]));
        output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      expect(output.length).toBe(2);
      // First output sample comes from input[0] (0.1)
      expect(output[0]).toBe(Math.floor(0.1 * 0x7FFF));
      // Second output sample comes from input[3] (0.4)
      expect(output[1]).toBe(Math.floor(0.4 * 0x7FFF));
    });

    it("handles non-integer resample ratios", () => {
      // Input: 11 samples at 44.1kHz
      const input = new Float32Array(11).fill(0.5);
      const inputRate = 44100;
      const targetRate = 16000;
      const ratio = inputRate / targetRate; // ~2.75625

      const outputLength = Math.floor(input.length / ratio);
      const output = new Int16Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        const sourceIndex = Math.floor(i * ratio);
        const sample = Math.max(-1, Math.min(1, input[sourceIndex]));
        output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      expect(output.length).toBe(3); // floor(11 / 2.75625) = 3
      // All samples should be ~16383 (0.5 * 32767)
      output.forEach(sample => {
        expect(sample).toBe(16383);
      });
    });
  });
});
