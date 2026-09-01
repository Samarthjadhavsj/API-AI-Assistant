import { describe, it, expect } from 'vitest';
import { cn, floatArrayToWav } from './utils';

describe('utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('bg-red-500', 'text-white');
      expect(result).toContain('bg-red-500');
      expect(result).toContain('text-white');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
    });

    it('should handle conflicting Tailwind classes', () => {
      const result = cn('p-4', 'p-6'); // p-6 should win
      expect(result).toBe('p-6');
    });

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'active');
      expect(result).toContain('base');
      expect(result).toContain('active');
    });
  });

  describe('floatArrayToWav', () => {
    it('should convert Float32Array to WAV blob', () => {
      const audioData = new Float32Array([0.1, 0.2, 0.3, -0.1, -0.2]);
      const sampleRate = 16000;

      const blob = floatArrayToWav(audioData, sampleRate);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBeGreaterThan(44); // WAV header is 44 bytes
    });

    it('should create correct blob size', () => {
      const audioData = new Float32Array(100);
      const blob = floatArrayToWav(audioData);

      // WAV header (44 bytes) + data (100 * 2 bytes for 16-bit)
      expect(blob.size).toBe(44 + 100 * 2);
    });

    it('should handle different sample rates', () => {
      const audioData = new Float32Array([0.5, -0.5]);
      
      const blob16k = floatArrayToWav(audioData, 16000);
      const blob44k = floatArrayToWav(audioData, 44100);

      expect(blob16k.size).toBe(blob44k.size); // Data size same, only header differs
    });

    it('should handle edge case values', () => {
      const audioData = new Float32Array([1.0, -1.0, 0.0]);
      const blob = floatArrayToWav(audioData);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(44 + 3 * 2);
    });

    it('should clamp values outside -1 to 1 range', () => {
      const audioData = new Float32Array([1.5, -1.5, 0.5]);
      const blob = floatArrayToWav(audioData);

      // Should not throw and should produce valid blob
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle empty audio data', () => {
      const audioData = new Float32Array([]);
      const blob = floatArrayToWav(audioData);

      expect(blob.size).toBe(44); // Just the WAV header
    });
  });
});
