/**
 * AudioWorklet processor that converts microphone audio to 16-bit PCM at 16kHz.
 * Runs in the audio worklet thread, separate from the main thread.
 */

// AudioWorklet global scope types
declare const sampleRate: number;
declare function registerProcessor(name: string, processorCtor: any): void;

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare const AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: any): AudioWorkletProcessor;
};

const TARGET_SAMPLE_RATE = 16000;

class PcmProcessorWorklet extends AudioWorkletProcessor {
  private inputSampleRate: number;
  private resampleRatio: number;
  private resampleBuffer: Float32Array;
  private resampleBufferSize: number;
  private resampleBufferIndex: number;

  constructor() {
    super();
    this.inputSampleRate = sampleRate; // Global from AudioWorkletGlobalScope
    this.resampleRatio = this.inputSampleRate / TARGET_SAMPLE_RATE;

    // Buffer size to hold enough samples for resampling
    this.resampleBufferSize = Math.ceil(4096 * this.resampleRatio);
    this.resampleBuffer = new Float32Array(this.resampleBufferSize);
    this.resampleBufferIndex = 0;
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true; // Keep processor alive
    }

    const inputChannel = input[0]; // Mono channel

    // Accumulate input samples
    for (let i = 0; i < inputChannel.length; i++) {
      if (this.resampleBufferIndex >= this.resampleBufferSize) {
        // Buffer full, process it
        this.processBuffer();
        this.resampleBufferIndex = 0;
      }
      this.resampleBuffer[this.resampleBufferIndex++] = inputChannel[i];
    }

    return true; // Keep processor alive
  }

  private processBuffer(): void {
    if (this.resampleBufferIndex === 0) return;

    // Simple downsampling: take every Nth sample
    const outputLength = Math.floor(this.resampleBufferIndex / this.resampleRatio);
    const pcmData = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = Math.floor(i * this.resampleRatio);
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, this.resampleBuffer[sourceIndex]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    // Send PCM data to main thread
    this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
  }
}

registerProcessor('pcm-processor-worklet', PcmProcessorWorklet);
