// @vitest-environment node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build, createServer, type Rollup } from "vite";
import { describe, expect, it } from "vitest";

/**
 * The PCM worklet must reach audioWorklet.addModule() as compiled JavaScript.
 * Loading the .ts file with `new URL(...)` used to work in dev (Vite compiles on
 * request) but shipped raw TypeScript as `data:video/mp2t` in production, which
 * addModule() rejects — so live voice failed only in the packaged app.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));
const STREAMER = path.join(root, "src/lib/voice/LivePcmStreamer.ts");
const TS_ONLY_SYNTAX = /\bdeclare\s|\binterface\s|\bprivate\s+\w+\s*:|:\s*(number|boolean|string)\b/;

/** Runs a compiled worklet against fake AudioWorkletGlobalScope globals. */
function runWorklet(code: string) {
  const registered: Record<string, new () => any> = {};
  const posted: ArrayBuffer[] = [];
  class FakeAudioWorkletProcessor {
    port = { postMessage: (data: ArrayBuffer) => posted.push(data) };
  }
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", code)(
    FakeAudioWorkletProcessor,
    (name: string, ctor: new () => any) => (registered[name] = ctor),
    48_000
  );
  return { registered, posted };
}

describe("PCM worklet bundling", () => {
  it("production: emits a compiled JavaScript worklet asset that addModule() receives", async () => {
    const result = await build({
      configFile: false,
      root,
      logLevel: "silent",
      build: {
        write: false,
        rollupOptions: { input: STREAMER, preserveEntrySignatures: "exports-only" },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
    const files = outputs.flatMap((output) => output.output);

    const worklet = files.find((file) => /pcm-processor\.worklet-[\w-]+\.js$/.test(file.fileName));
    expect(worklet, "worklet emitted as its own .js file").toBeDefined();
    const workletCode =
      worklet!.type === "asset" ? String(worklet!.source) : (worklet as Rollup.OutputChunk).code;
    expect(workletCode).not.toMatch(TS_ONLY_SYNTAX);

    // It's real, working JavaScript: registers the processor and emits 16 kHz PCM.
    const { registered, posted } = runWorklet(workletCode);
    const Processor = registered["pcm-processor-worklet"];
    expect(Processor).toBeTypeOf("function");
    const processor = new Processor();
    const block = new Float32Array(128).fill(0.5);
    for (let i = 0; i < 200; i++) processor.process([[block]], [], {});
    expect(posted.length).toBeGreaterThan(0);
    expect(new Int16Array(posted[0])[0]).toBe(Math.floor(0.5 * 0x7fff));

    // The streamer hands addModule() that asset's URL — never an inlined data: URL.
    const entry = files.find(
      (file): file is Rollup.OutputChunk => file.type === "chunk" && file.isEntry
    )!;
    expect(entry.code).toContain(`/${worklet!.fileName}`);
    expect(entry.code).toContain("addModule(");
    for (const file of files) {
      const code = file.type === "chunk" ? file.code : String(file.source);
      expect(code).not.toContain("data:video/mp2t");
      expect(code).not.toMatch(/data:[^"'`]*;base64,[^"'`]*registerProcessor/);
    }
  }, 60_000);

  it("development: the worklet URL is served as compiled JavaScript", async () => {
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      // What LivePcmStreamer imports, then what the browser fetches for addModule().
      const urlModule = await server.transformRequest(
        "/src/lib/voice/pcm-processor.worklet.ts?worker&url"
      );
      const workletUrl = /export default\s+"([^"]+)"/.exec(urlModule!.code)?.[1];
      expect(workletUrl).toMatch(/^\/src\/lib\/voice\/pcm-processor\.worklet\.ts\?worker_file/);

      const worklet = await server.transformRequest(workletUrl!);
      expect(worklet!.code).toContain('registerProcessor("pcm-processor-worklet"');
      expect(worklet!.code).not.toMatch(TS_ONLY_SYNTAX);
    } finally {
      await server.close();
    }
  }, 60_000);
});
