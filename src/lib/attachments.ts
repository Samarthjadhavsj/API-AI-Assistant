import type { AttachedFile } from "@/types/completion";
import type { TYPE_PROVIDER } from "@/types/provider.type";

/**
 * File attachments: what can be attached, how files are read and checked, and
 * what each AI provider accepts.
 *
 * Images are sent to the provider as image parts. Text and code files are sent
 * as text inside the message, so every provider can read them. Anything else
 * (PDF, Word, spreadsheets, audio, video, archives) has no path to the
 * provider in this app and is refused with a clear reason.
 */

export const MIB = 1024 * 1024;
export const KIB = 1024;

/** Largest image the app will read. Provider limits can be lower (see below). */
export const MAX_IMAGE_BYTES = 20 * MIB;
/** Largest text/code file the app will read and inline into a message. */
export const MAX_TEXT_FILE_BYTES = 256 * KIB;

export type ImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const IMAGE_FORMAT_NAMES: Record<ImageMimeType, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/gif": "GIF",
};

/** Image files this app can attach, identified from their content. */
export const SUPPORTED_IMAGE_TYPES = Object.keys(IMAGE_FORMAT_NAMES) as ImageMimeType[];

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "jpe", "jfif", "webp", "gif"];

/** Images no provider here accepts: rejected with a "convert it" hint. */
const UNSUPPORTED_IMAGE_EXTENSIONS: Record<string, string> = {
  bmp: "BMP",
  tif: "TIFF",
  tiff: "TIFF",
  heic: "HEIC",
  heif: "HEIF",
  avif: "AVIF",
  ico: "ICO",
  psd: "PSD",
  raw: "RAW",
  cr2: "RAW",
  nef: "RAW",
  dng: "RAW",
};

/** Text and code files, sent as text. */
const TEXT_EXTENSIONS = new Set([
  // Plain text and docs
  "txt", "text", "md", "markdown", "mdx", "rst", "adoc", "tex", "log", "srt", "vtt",
  // Data
  "csv", "tsv", "json", "jsonc", "json5", "jsonl", "ndjson", "xml", "yaml", "yml",
  "toml", "ini", "cfg", "conf", "properties", "env", "graphql", "gql", "proto", "sql",
  // Web
  "html", "htm", "css", "scss", "sass", "less", "svg", "vue", "svelte", "astro",
  // JavaScript / TypeScript
  "js", "mjs", "cjs", "jsx", "ts", "mts", "cts", "tsx",
  // Other languages
  "py", "pyi", "ipynb", "rb", "php", "java", "kt", "kts", "scala", "groovy", "gradle",
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "hxx", "cs", "fs", "fsx", "vb",
  "go", "rs", "swift", "m", "mm", "dart", "lua", "pl", "pm", "r", "jl", "hs", "elm",
  "ex", "exs", "erl", "clj", "cljs", "lisp", "ml", "nim", "zig", "sol", "asm", "s",
  // Shell and build
  "sh", "bash", "zsh", "fish", "ps1", "psm1", "bat", "cmd", "mk", "cmake", "dockerfile",
  "tf", "hcl", "nix", "lock", "gitignore", "gitattributes", "editorconfig", "diff", "patch",
]);

/** Well-known extensionless text files. */
const TEXT_FILE_NAMES = new Set([
  "dockerfile", "makefile", "gemfile", "rakefile", "procfile", "vagrantfile",
  "jenkinsfile", "license", "readme", "changelog", "authors", "codeowners",
  ".gitignore", ".gitattributes", ".editorconfig", ".npmrc", ".nvmrc",
  ".prettierrc", ".eslintrc", ".babelrc", ".env",
]);

const TEXT_MIME_TYPES = new Set([
  "application/json", "application/ld+json", "application/xml", "application/javascript",
  "application/x-javascript", "application/typescript", "application/x-typescript",
  "application/x-yaml", "application/yaml", "application/toml", "application/sql",
  "application/x-sh", "application/x-httpd-php", "application/graphql", "image/svg+xml",
]);

/** Formats with no route to the provider in this app, with what to do instead. */
const UNSUPPORTED_FORMATS: { extensions: string[]; mimePrefixes: string[]; reason: string }[] = [
  {
    extensions: ["pdf"],
    mimePrefixes: ["application/pdf"],
    reason: "PDFs aren't supported yet. Paste the text or attach a screenshot of the page.",
  },
  {
    extensions: ["doc", "docx", "docm", "odt", "rtf", "pages"],
    mimePrefixes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml",
      "application/vnd.oasis.opendocument.text",
      "application/rtf",
    ],
    reason: "Word documents aren't supported. Paste the text or save it as .txt or .md.",
  },
  {
    extensions: ["xls", "xlsx", "xlsm", "ods", "numbers"],
    mimePrefixes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml",
      "application/vnd.oasis.opendocument.spreadsheet",
    ],
    reason: "Spreadsheets aren't supported. Save the sheet as .csv and attach that.",
  },
  {
    extensions: ["ppt", "pptx", "odp", "key"],
    mimePrefixes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml",
    ],
    reason: "Presentations aren't supported. Attach screenshots of the slides instead.",
  },
  {
    extensions: ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "opus", "wma", "aiff"],
    mimePrefixes: ["audio/"],
    reason: "Audio files aren't supported. Use voice input to dictate instead.",
  },
  {
    extensions: ["mp4", "mov", "avi", "mkv", "webm", "wmv", "flv", "m4v", "3gp"],
    mimePrefixes: ["video/"],
    reason: "Video files aren't supported. Attach a screenshot of the frame instead.",
  },
  {
    extensions: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"],
    mimePrefixes: ["application/zip", "application/x-7z", "application/x-rar", "application/gzip"],
    reason: "Archives aren't supported. Extract the files and attach them individually.",
  },
];

/** The `accept` list for the file picker: everything that can be attached. */
export const ATTACHMENT_ACCEPT = [
  ...IMAGE_EXTENSIONS.map((ext) => `.${ext}`),
  ...[...TEXT_EXTENSIONS].map((ext) => `.${ext}`),
  "text/*",
].join(",");

export const formatBytes = (bytes: number): string => {
  if (bytes < KIB) return `${bytes} B`;
  if (bytes < MIB) return `${Math.round(bytes / KIB)} KB`;
  return `${(bytes / MIB).toFixed(1)} MB`;
};

const extensionOf = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

const baseNameOf = (name: string): string =>
  (name.split(/[\\/]/).pop() ?? name).toLowerCase();

export const isImageAttachment = (file: Pick<AttachedFile, "kind" | "type">): boolean =>
  file.kind ? file.kind === "image" : file.type.startsWith("image/");

export const isTextAttachment = (file: Pick<AttachedFile, "kind">): boolean =>
  file.kind === "text";

let attachmentCounter = 0;
/** Unique even for several files added in the same millisecond. */
export const createAttachmentId = (): string =>
  `att_${Date.now().toString(36)}_${(attachmentCounter++).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

/** Identifies an image from its first bytes, ignoring the name and reported type. */
export const sniffImageType = (bytes: Uint8Array): ImageMimeType | null => {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return "image/gif";
  }
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
};

/**
 * Decodes a text file (UTF-8, or UTF-16 with a byte-order mark). Returns null
 * for binary content, so a renamed binary file is never sent as garbage text.
 */
export const decodeTextFile = (bytes: Uint8Array): string | null => {
  let encoding = "utf-8";
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    offset = 2;
  }

  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
  } catch {
    return null;
  }
  // NUL characters don't occur in real text files.
  if (text.includes("\u0000")) return null;
  return text;
};

/** Decoded size of base64 data. */
export const base64ByteLength = (base64: string): number => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const readFileBytes = (file: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.onabort = () => reject(new Error("Reading the file was cancelled"));
    reader.readAsArrayBuffer(file);
  });

export type AttachmentCategory =
  | { kind: "image" }
  | { kind: "text" }
  | { kind: "unknown" }
  | { kind: "unsupported"; reason: string };

/** Reported image types that are really one of the supported formats. */
const IMAGE_TYPE_ALIASES = ["image/jpg", "image/pjpeg", "image/x-png"];

const unsupportedImage = (label: string): AttachmentCategory => ({
  kind: "unsupported",
  reason: `${label} images aren't supported by AI providers. Convert it to PNG or JPEG.`,
});

/**
 * Decides what a file is from its name and reported type, before reading it.
 * The extension wins over the reported type: Windows reports `.ts` files as
 * "video/mp2t", for example.
 */
export const categorizeFile = (file: Pick<File, "name" | "type">): AttachmentCategory => {
  const ext = extensionOf(file.name);
  const type = (file.type || "").toLowerCase();

  // SVG is XML markup: providers don't take it as an image, but can read it.
  if (ext === "svg" || type === "image/svg+xml") return { kind: "text" };

  if (ext) {
    const format = UNSUPPORTED_FORMATS.find((f) => f.extensions.includes(ext));
    if (format) return { kind: "unsupported", reason: format.reason };
    if (UNSUPPORTED_IMAGE_EXTENSIONS[ext]) return unsupportedImage(UNSUPPORTED_IMAGE_EXTENSIONS[ext]);
    if (IMAGE_EXTENSIONS.includes(ext)) return { kind: "image" };
    if (TEXT_EXTENSIONS.has(ext)) return { kind: "text" };
  }
  if (TEXT_FILE_NAMES.has(baseNameOf(file.name))) return { kind: "text" };

  const format = UNSUPPORTED_FORMATS.find((f) => f.mimePrefixes.some((p) => type.startsWith(p)));
  if (format) return { kind: "unsupported", reason: format.reason };

  if (type.startsWith("image/")) {
    return SUPPORTED_IMAGE_TYPES.includes(type as ImageMimeType) || IMAGE_TYPE_ALIASES.includes(type)
      ? { kind: "image" }
      : unsupportedImage(type.slice("image/".length).toUpperCase());
  }

  if (type.startsWith("text/") || TEXT_MIME_TYPES.has(type)) return { kind: "text" };

  return { kind: "unknown" };
};

export type AttachmentReadResult =
  | { ok: true; file: AttachedFile }
  | { ok: false; reason: string };

/**
 * Checks and reads a picked or pasted file. Every rejection carries a message
 * for the user; nothing is dropped silently.
 */
export const readAttachment = async (file: File): Promise<AttachmentReadResult> => {
  const name = file.name || "Pasted file";
  const fail = (reason: string): AttachmentReadResult => ({ ok: false, reason: `${name}: ${reason}` });

  if (file.size === 0) return fail("the file is empty.");

  const category = categorizeFile(file);
  if (category.kind === "unsupported") return fail(category.reason);

  const maxBytes = category.kind === "image" ? MAX_IMAGE_BYTES : MAX_TEXT_FILE_BYTES;
  if (file.size > maxBytes) {
    if (category.kind === "unknown") return fail("this file type isn't supported.");
    return fail(
      `the file is too large (${formatBytes(file.size)}). ${
        category.kind === "image" ? "Images" : "Text files"
      } can be up to ${formatBytes(maxBytes)}.`
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch (error) {
    console.error("[Attachments] Failed to read file:", error);
    return fail("the file couldn't be read. Check that it still exists and try again.");
  }
  if (bytes.length === 0) return fail("the file is empty.");

  if (category.kind === "image") {
    const imageType = sniffImageType(bytes);
    if (!imageType) {
      return fail("this isn't a valid PNG, JPEG, WebP or GIF image. The file may be damaged.");
    }
    return {
      ok: true,
      file: {
        id: createAttachmentId(),
        name,
        // The detected format, not the extension: a mislabeled image is still
        // described to the provider correctly.
        type: imageType,
        kind: "image",
        base64: bytesToBase64(bytes),
        size: bytes.length,
      },
    };
  }

  const text = decodeTextFile(bytes);
  if (text === null) {
    return fail(
      category.kind === "unknown"
        ? "this file type isn't supported."
        : "the file isn't readable text (it may be binary or use an unsupported encoding)."
    );
  }
  if (!text.trim()) return fail("the file has no text in it.");

  return {
    ok: true,
    file: {
      id: createAttachmentId(),
      name,
      type: file.type || "text/plain",
      kind: "text",
      base64: "",
      text,
      size: bytes.length,
    },
  };
};

/** Two attachments with the same content are the same attachment. */
export const isSameAttachment = (a: AttachedFile, b: AttachedFile): boolean =>
  isImageAttachment(a) === isImageAttachment(b) &&
  (isImageAttachment(a) ? a.base64 === b.base64 : a.text === b.text);

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

interface ProviderImageRules {
  name: string;
  formats: ImageMimeType[];
  /** Largest single image, in decoded bytes. */
  maxImageBytes?: number;
  /** Largest total of all images in one request, in decoded bytes. */
  maxTotalImageBytes?: number;
}

const COMMON_FORMATS: ImageMimeType[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Documented image limits of the built-in providers. Custom providers get the
 * common formats and the app-wide size limit.
 */
const PROVIDER_IMAGE_RULES: Record<string, ProviderImageRules> = {
  openai: { name: "OpenAI", formats: COMMON_FORMATS },
  // 10 MB per image, measured on the base64 text.
  claude: { name: "Claude", formats: COMMON_FORMATS, maxImageBytes: (10 * MIB * 3) / 4 },
  grok: { name: "Grok", formats: ["image/png", "image/jpeg"], maxImageBytes: 20 * MIB },
  // 20 MB per request including the prompt; base64 grows images by a third.
  gemini: {
    name: "Gemini",
    formats: ["image/png", "image/jpeg", "image/webp"],
    maxTotalImageBytes: 14 * MIB,
  },
  mistral: { name: "Mistral", formats: COMMON_FORMATS, maxImageBytes: 10 * MIB },
  cohere: { name: "Cohere", formats: COMMON_FORMATS },
  perplexity: { name: "Perplexity", formats: COMMON_FORMATS },
  openrouter: { name: "OpenRouter", formats: COMMON_FORMATS },
  ollama: { name: "Ollama", formats: COMMON_FORMATS },
};

/** Built-in providers whose templates have no image slot. */
const TEXT_ONLY_PROVIDER_NAMES: Record<string, string> = {
  groq: "Groq",
  deepseek: "DeepSeek",
};

const providerName = (provider: TYPE_PROVIDER): string =>
  (!provider.isCustom &&
    provider.id &&
    (PROVIDER_IMAGE_RULES[provider.id]?.name ?? TEXT_ONLY_PROVIDER_NAMES[provider.id])) ||
  provider.name ||
  provider.id ||
  "The selected provider";

/** Whether the provider's request template has a slot for images. */
export const providerSupportsImages = (provider: TYPE_PROVIDER): boolean =>
  typeof provider.curl === "string" && provider.curl.includes("{{IMAGE}}");

const quoteNames = (files: AttachedFile[]) => files.map((f) => `"${f.name}"`).join(", ");

/**
 * Checks attachments against what the selected provider accepts, before the
 * request is sent. Returns a message for the user, or null when all is well.
 */
export const validateAttachmentsForProvider = (
  provider: TYPE_PROVIDER,
  attachments: AttachedFile[]
): string | null => {
  const images = attachments.filter(isImageAttachment);
  if (images.length === 0) return null;

  const name = providerName(provider);
  if (!providerSupportsImages(provider)) {
    return `${name} can't read images. Remove ${quoteNames(images)} or switch to a provider that supports images.`;
  }

  const rules: ProviderImageRules =
    (!provider.isCustom && provider.id && PROVIDER_IMAGE_RULES[provider.id]) || {
      name,
      formats: COMMON_FORMATS,
    };

  const wrongFormat = images.filter((f) => !rules.formats.includes(f.type as ImageMimeType));
  if (wrongFormat.length > 0) {
    const accepted = rules.formats.map((t) => IMAGE_FORMAT_NAMES[t]).join(", ");
    return `${name} doesn't accept ${quoteNames(wrongFormat)} (it accepts ${accepted}). Remove it or switch provider.`;
  }

  const maxImage = Math.min(rules.maxImageBytes ?? MAX_IMAGE_BYTES, MAX_IMAGE_BYTES);
  const tooLarge = images.filter((f) => f.size > maxImage);
  if (tooLarge.length > 0) {
    return `${quoteNames(tooLarge)} is too large for ${name} (up to ${formatBytes(maxImage)} per image).`;
  }

  if (rules.maxTotalImageBytes) {
    const total = images.reduce((sum, f) => sum + f.size, 0);
    if (total > rules.maxTotalImageBytes) {
      return `These images are too large to send to ${name} together (${formatBytes(
        total
      )}, up to ${formatBytes(rules.maxTotalImageBytes)}). Remove some and try again.`;
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Building the message
// ---------------------------------------------------------------------------

/** Fence that can't be closed early by backticks inside the file. */
const fenceFor = (text: string): string => {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(longest + 1);
};

/**
 * The text sent to the provider: text/code files inlined ahead of the user's
 * message. Files sharing a name (picked from different folders) are numbered
 * so the model can tell them apart.
 */
export const buildPromptWithTextFiles = (
  userMessage: string,
  attachments: Pick<AttachedFile, "name" | "kind" | "text">[] = []
): string => {
  const textFiles = attachments.filter((f) => f.kind === "text" && typeof f.text === "string");
  if (textFiles.length === 0) return userMessage;

  const seen = new Map<string, number>();
  const blocks = textFiles.map((file) => {
    const count = (seen.get(file.name) ?? 0) + 1;
    seen.set(file.name, count);
    const label = count > 1 ? `${file.name} (${count})` : file.name;
    const text = (file.text as string).replace(/\r\n/g, "\n");
    const fence = fenceFor(text);
    const lang = extensionOf(file.name);
    return `Attached file: ${label}\n${fence}${lang}\n${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;
  });

  return `${blocks.join("\n\n")}\n\n${userMessage}`;
};

/** Default question when only attachments are sent. */
export const defaultPromptFor = (attachments: AttachedFile[]): string =>
  attachments.length > 0 && attachments.every(isImageAttachment)
    ? "What's in this image?"
    : attachments.length > 1
      ? "Please review the attached files."
      : "Please review the attached file.";

/**
 * What is stored with a saved message: names and sizes of every attachment,
 * and the text of text files (so a continued conversation still has them).
 * Image data is not stored, to keep the history database small.
 */
export const toStoredAttachments = (attachments: AttachedFile[]): AttachedFile[] =>
  attachments.map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    kind: isImageAttachment(file) ? "image" : "text",
    base64: "",
    ...(isTextAttachment(file) && typeof file.text === "string" ? { text: file.text } : {}),
  }));
