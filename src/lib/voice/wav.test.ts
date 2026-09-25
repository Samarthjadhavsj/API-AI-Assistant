import { describe, expect, it } from "vitest";
import { encodeWav, recordingToWav } from "./wav";

const text = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit PCM WAV", () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000));

    expect(text(view, 0, 4)).toBe("RIFF");
    expect(text(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 16383]);
  });

  it("clips out-of-range samples", () => {
    const view = new DataView(encodeWav(new Float32Array([2, -3]), 16000));
    expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([32767, -32768]);
  });
});

describe("recordingToWav", () => {
  it("passes WAV recordings through unchanged", async () => {
    const wav = new Blob(["RIFF"], { type: "audio/wav" });
    expect(await recordingToWav(wav)).toBe(wav);
  });
});
