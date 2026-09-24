import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "@/config/ai-providers.constants";
import type { AttachedFile } from "@/types/completion";
import {
  base64ByteLength,
  buildPromptWithTextFiles,
  categorizeFile,
  createAttachmentId,
  defaultPromptFor,
  MAX_IMAGE_BYTES,
  MAX_TEXT_FILE_BYTES,
  MIB,
  readAttachment,
  toStoredAttachments,
  validateAttachmentsForProvider,
} from "./attachments";

// Real file signatures
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20];

const file = (bytes: number[] | Uint8Array | string, name: string, type = "") =>
  new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name, { type });

/** A file that reports a size without allocating it (checked before reading). */
const sizedFile = (name: string, size: number, type = "") => {
  const f = file([1], name, type);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

const provider = (id: string) => {
  const p = AI_PROVIDERS.find((candidate) => candidate.id === id);
  if (!p) throw new Error(`no provider ${id}`);
  return p;
};

const image = (name: string, type: string, size = 1000): AttachedFile => ({
  id: name,
  name,
  type,
  kind: "image",
  base64: "AAAA",
  size,
});
const textFile = (name: string, text: string): AttachedFile => ({
  id: name,
  name,
  type: "text/plain",
  kind: "text",
  base64: "",
  text,
  size: text.length,
});

describe("categorizeFile", () => {
  it.each(["a.png", "a.jpg", "a.jpeg", "a.webp", "a.gif", "A.JPG"])("%s is an image", (name) => {
    expect(categorizeFile({ name, type: "" }).kind).toBe("image");
  });

  it.each([
    "notes.txt", "README.md", "data.csv", "data.json", "feed.xml", "config.yaml", "config.yml",
    "app.js", "app.tsx", "Main.java", "main.py", "lib.rs", "main.go", "query.sql", "run.sh",
    "Dockerfile", ".env", "icon.svg",
  ])("%s is text", (name) => {
    expect(categorizeFile({ name, type: "" }).kind).toBe("text");
  });

  it("uses the extension over the reported type (Windows reports .ts as video)", () => {
    expect(categorizeFile({ name: "index.ts", type: "video/mp2t" }).kind).toBe("text");
    expect(categorizeFile({ name: "lib.rs", type: "application/rls-services+xml" }).kind).toBe("text");
  });

  it("treats SVG as text, since providers don't accept it as an image", () => {
    expect(categorizeFile({ name: "logo", type: "image/svg+xml" }).kind).toBe("text");
  });

  it.each([
    ["report.pdf", "", /PDFs aren't supported/],
    ["letter.docx", "", /Word documents/],
    ["old.doc", "application/msword", /Word documents/],
    ["budget.xlsx", "", /Spreadsheets.*\.csv/],
    ["budget.xls", "", /Spreadsheets/],
    ["deck.pptx", "", /Presentations/],
    ["voice.mp3", "audio/mpeg", /Audio files/],
    ["clip.mp4", "video/mp4", /Video files/],
    ["bundle.zip", "application/zip", /Archives/],
    ["photo.heic", "image/heic", /HEIC images aren't supported/],
    ["scan.tiff", "image/tiff", /TIFF images/],
    ["pic.bmp", "image/bmp", /BMP images/],
    ["nameless", "image/avif", /AVIF images/],
  ])("%s is refused with a reason", (name, type, reason) => {
    const result = categorizeFile({ name, type });
    expect(result.kind).toBe("unsupported");
    expect(result.kind === "unsupported" && result.reason).toMatch(reason);
  });

  it("does not know a file with an unknown extension and type", () => {
    expect(categorizeFile({ name: "data.xyz", type: "" }).kind).toBe("unknown");
  });
});

describe("readAttachment", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["PNG", PNG, "image/png"],
    ["JPEG", JPEG, "image/jpeg"],
    ["WebP", WEBP, "image/webp"],
    ["GIF", GIF, "image/gif"],
  ])("reads a %s image with its real type", async (_label, bytes, type) => {
    const result = await readAttachment(file(bytes, "picture.img.png"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toMatchObject({ kind: "image", type, size: bytes.length });
    expect(result.file.base64).toBe(btoa(String.fromCharCode(...bytes)));
  });

  it("describes a mislabeled image by its content, not its extension", async () => {
    const result = await readAttachment(file(JPEG, "actually-a-jpeg.png", "image/png"));
    expect(result.ok && result.file.type).toBe("image/jpeg");
  });

  it("refuses a damaged image instead of sending garbage", async () => {
    const result = await readAttachment(file("not really a png", "broken.png", "image/png"));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/broken\.png: .*isn't a valid PNG, JPEG, WebP or GIF/) });
  });

  it("refuses an empty file", async () => {
    expect(await readAttachment(file([], "empty.png", "image/png"))).toEqual({
      ok: false,
      reason: "empty.png: the file is empty.",
    });
    expect(await readAttachment(file([], "empty.txt", "text/plain"))).toMatchObject({ ok: false });
  });

  it("refuses a very large image before reading it", async () => {
    const reader = vi.spyOn(FileReader.prototype, "readAsArrayBuffer");
    const result = await readAttachment(sizedFile("huge.png", MAX_IMAGE_BYTES + 1, "image/png"));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/huge\.png: the file is too large \(20\.0 MB\)\. Images can be up to 20\.0 MB/) });
    expect(reader).not.toHaveBeenCalled();
  });

  it("refuses a very large text file before reading it", async () => {
    const result = await readAttachment(sizedFile("dump.log", MAX_TEXT_FILE_BYTES + 1));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/Text files can be up to 256 KB/) });
  });

  it("refuses unsupported documents without reading them", async () => {
    const reader = vi.spyOn(FileReader.prototype, "readAsArrayBuffer");
    const result = await readAttachment(file("%PDF-1.7", "report.pdf", "application/pdf"));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/^report\.pdf: PDFs aren't supported/) });
    expect(reader).not.toHaveBeenCalled();
  });

  it("reads a UTF-8 code file as text", async () => {
    const code = "const greeting = `hÃ©llo âœ“`;\nexport default greeting;\n";
    const result = await readAttachment(file(code, "greeting.ts", "video/mp2t"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toMatchObject({ kind: "text", text: code, base64: "", name: "greeting.ts" });
    expect(result.file.size).toBe(new TextEncoder().encode(code).length);
  });

  it("strips a UTF-8 byte-order mark", async () => {
    const result = await readAttachment(file([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62], "data.csv"));
    expect(result.ok && result.file.text).toBe("a,b");
  });

  it("reads UTF-16 text (Windows 'Unicode' files)", async () => {
    const utf16 = [0xff, 0xfe, 0x68, 0, 0x69, 0]; // BOM + "hi"
    const result = await readAttachment(file(utf16, "notes.txt"));
    expect(result.ok && result.file.text).toBe("hi");
  });

  it("refuses a binary file disguised as text", async () => {
    const result = await readAttachment(file([0x50, 0x4b, 0x03, 0x04, 0, 0, 0x14, 0], "archive.txt"));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/archive\.txt: the file isn't readable text/) });
  });

  it("refuses text that isn't valid UTF-8", async () => {
    const result = await readAttachment(file([0x63, 0x61, 0x66, 0xe9, 0x21], "latin1.txt"));
    expect(result.ok).toBe(false);
  });

  it("refuses a text file with nothing in it but whitespace", async () => {
    const result = await readAttachment(file("  \n\t\n", "blank.md"));
    expect(result).toEqual({ ok: false, reason: "blank.md: the file has no text in it." });
  });

  it("accepts an unknown file type when its content is text", async () => {
    const result = await readAttachment(file("key = value\n", "settings.custom"));
    expect(result.ok && result.file).toMatchObject({ kind: "text", type: "text/plain" });
  });

  it("refuses an unknown binary file type", async () => {
    const result = await readAttachment(file([0, 1, 2, 3, 0, 255], "blob.bin"));
    expect(result).toEqual({ ok: false, reason: "blob.bin: this file type isn't supported." });
  });

  it("keeps long and Unicode file names intact", async () => {
    const name = `${"Ð¾Ñ‡ÐµÐ½ÑŒ-Ð´Ð»Ð¸Ð½Ð½Ð¾Ðµ-Ð¸Ð¼Ñ-".repeat(12)}å†™çœŸ ðŸ–¼ï¸.png`;
    const result = await readAttachment(file(PNG, name));
    expect(result.ok && result.file.name).toBe(name);
  });

  it("reports a file that can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.onerror?.(new ProgressEvent("error") as any));
    });
    const result = await readAttachment(file(PNG, "gone.png"));
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/gone\.png: the file couldn't be read/) });
  });
});

describe("createAttachmentId", () => {
  it("is unique for files added in the same millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const ids = new Set(Array.from({ length: 500 }, createAttachmentId));
    vi.restoreAllMocks();
    expect(ids.size).toBe(500);
  });
});

describe("validateAttachmentsForProvider", () => {
  it("allows text files with any provider, including ones without image support", () => {
    expect(validateAttachmentsForProvider(provider("groq"), [textFile("a.ts", "x")])).toBeNull();
    expect(validateAttachmentsForProvider(provider("deepseek"), [textFile("a.ts", "x")])).toBeNull();
  });

  it("explains that a provider without image support can't take images", () => {
    const message = validateAttachmentsForProvider(provider("groq"), [image("cat.png", "image/png")]);
    expect(message).toBe(
      'Groq can\'t read images. Remove "cat.png" or switch to a provider that supports images.'
    );
  });

  it.each([
    ["openai", ["image/png", "image/jpeg", "image/webp", "image/gif"]],
    ["claude", ["image/png", "image/jpeg", "image/webp", "image/gif"]],
    ["gemini", ["image/png", "image/jpeg", "image/webp"]],
    ["grok", ["image/png", "image/jpeg"]],
    ["mistral", ["image/png", "image/jpeg", "image/webp", "image/gif"]],
  ])("%s accepts its documented formats", (id, types) => {
    const images = types.map((type, i) => image(`img${i}`, type));
    expect(validateAttachmentsForProvider(provider(id), images)).toBeNull();
  });

  it("names formats a provider doesn't accept", () => {
    expect(validateAttachmentsForProvider(provider("gemini"), [image("anim.gif", "image/gif")])).toBe(
      'Gemini doesn\'t accept "anim.gif" (it accepts PNG, JPEG, WebP). Remove it or switch provider.'
    );
    expect(validateAttachmentsForProvider(provider("grok"), [image("a.webp", "image/webp")])).toMatch(
      /Grok doesn't accept "a\.webp" \(it accepts PNG, JPEG\)/
    );
  });

  it("applies per-image size limits", () => {
    const big = image("big.jpg", "image/jpeg", 8 * MIB);
    expect(validateAttachmentsForProvider(provider("claude"), [big])).toMatch(
      /"big\.jpg" is too large for Claude \(up to 7\.5 MB per image\)/
    );
    expect(validateAttachmentsForProvider(provider("openai"), [big])).toBeNull();
  });

  it("applies Gemini's total request limit", () => {
    const images = [image("a.jpg", "image/jpeg", 8 * MIB), image("b.jpg", "image/jpeg", 8 * MIB)];
    expect(validateAttachmentsForProvider(provider("gemini"), images)).toMatch(
      /too large to send to Gemini together/
    );
  });

  it("gives custom providers the common formats", () => {
    const custom = { id: "claude", isCustom: true, name: "My proxy", curl: '{"image": "{{IMAGE}}"}' };
    expect(validateAttachmentsForProvider(custom, [image("a.gif", "image/gif", 9 * MIB)])).toBeNull();
    expect(validateAttachmentsForProvider(custom, [image("a.png", "image/png")])).toBeNull();
    expect(validateAttachmentsForProvider({ ...custom, curl: "{}" }, [image("a.png", "image/png")])).toMatch(
      /^My proxy can't read images/
    );
  });
});

describe("buildPromptWithTextFiles", () => {
  it("returns the message unchanged without text files", () => {
    expect(buildPromptWithTextFiles("Hi", [])).toBe("Hi");
    expect(buildPromptWithTextFiles("Hi", [image("a.png", "image/png")])).toBe("Hi");
    expect(buildPromptWithTextFiles("Hi")).toBe("Hi");
  });

  it("puts each file in a fenced block before the question", () => {
    const prompt = buildPromptWithTextFiles("What does this do?", [textFile("main.py", "print('hi')\n")]);
    expect(prompt).toBe("Attached file: main.py\n```py\nprint('hi')\n```\n\nWhat does this do?");
  });

  it("uses a fence longer than any backticks inside the file", () => {
    const markdown = "# Notes\n```js\nx()\n```\n";
    const prompt = buildPromptWithTextFiles("Summarize", [textFile("notes.md", markdown)]);
    expect(prompt).toBe(`Attached file: notes.md\n\`\`\`\`md\n${markdown}\`\`\`\`\n\nSummarize`);
  });

  it("numbers files that share a name (picked from different folders)", () => {
    const prompt = buildPromptWithTextFiles("Compare", [
      textFile("index.ts", "a"),
      textFile("index.ts", "b"),
    ]);
    expect(prompt).toContain("Attached file: index.ts\n");
    expect(prompt).toContain("Attached file: index.ts (2)\n");
  });

  it("normalizes Windows line endings", () => {
    expect(buildPromptWithTextFiles("?", [textFile("a.txt", "one\r\ntwo")])).toContain("one\ntwo\n");
  });
});

describe("helpers", () => {
  it("defaultPromptFor asks about images, or about files otherwise", () => {
    expect(defaultPromptFor([image("a.png", "image/png")])).toBe("What's in this image?");
    expect(defaultPromptFor([textFile("a.ts", "x")])).toBe("Please review the attached file.");
    expect(defaultPromptFor([textFile("a.ts", "x"), image("a.png", "image/png")])).toBe(
      "Please review the attached files."
    );
  });

  it("toStoredAttachments keeps names, sizes and text, but not image data", () => {
    const stored = toStoredAttachments([
      { ...image("a.png", "image/png"), base64: "HUGE" },
      textFile("b.ts", "code"),
      // Older screenshots had no kind
      { id: "s", name: "screenshot.png", type: "image/png", base64: "X", size: 1 },
    ]);
    expect(stored).toEqual([
      { id: "a.png", name: "a.png", type: "image/png", size: 1000, kind: "image", base64: "" },
      { id: "b.ts", name: "b.ts", type: "text/plain", size: 4, kind: "text", base64: "", text: "code" },
      { id: "s", name: "screenshot.png", type: "image/png", size: 1, kind: "image", base64: "" },
    ]);
  });

  it("base64ByteLength gives the decoded size", () => {
    expect(base64ByteLength(btoa("a"))).toBe(1);
    expect(base64ByteLength(btoa("ab"))).toBe(2);
    expect(base64ByteLength(btoa("abc"))).toBe(3);
    expect(base64ByteLength("")).toBe(0);
  });
});
