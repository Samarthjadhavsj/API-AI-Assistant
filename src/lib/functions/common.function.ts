import { Message } from "@/types";

export function getByPath(obj: any, path: string): any {
  if (!path) return obj;
  return path
    .replace(/\[/g, ".")
    .replace(/\]/g, "")
    .split(".")
    .reduce((o, k) => (o || {})[k], obj);
}

export function setByPath(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i].replace(/\[(\d+)\]/g, ".$1");
    if (!current[key]) current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    current = current[key];
  }
  current[keys[keys.length - 1].replace(/\[(\d+)\]/g, ".$1")] = value;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = (reader.result as string)?.split(",")[1] ?? "";
      resolve(base64data);
    };
    reader.onerror = reject;
  });
}

export function extractVariables(
  curl: string,
  includeAll = false
): { key: string; value: string }[] {
  if (typeof curl !== "string") {
    return [];
  }

  const regex = /\{\{([A-Z_]+)\}\}/g;
  const matches = curl?.match(regex) || [];
  const variables = matches
    .map((match) => {
      if (typeof match === "string") {
        return match.slice(2, -2);
      }
      return "";
    })
    .filter((v) => v !== "");

  const uniqueVariables = [...new Set(variables)];

  const doNotInclude = includeAll
    ? []
    : ["SYSTEM_PROMPT", "TEXT", "IMAGE", "AUDIO"];

  const filteredVariables = uniqueVariables?.filter(
    (variable) => !doNotInclude?.includes(variable)
  );

  return filteredVariables.map((variable) => ({
    key: variable?.toLowerCase()?.replace(/_/g, "_") || "",
    value: variable,
  }));
}

/** An image to send: base64 data and its real MIME type. */
export interface ImageInput {
  data: string;
  mimeType: string;
}

/** Plain base64 strings are screenshots, which are always PNG. */
const toImageInput = (image: string | ImageInput): ImageInput =>
  typeof image === "string" ? { data: image, mimeType: "image/png" } : image;

/**
 * Provider templates hard-code a MIME type next to the image slot
 * ("data:image/png;base64,{{IMAGE}}", "media_type": "image/png", ...). Point it
 * at the image's real type, or JPEG/WebP/GIF images are sent mislabeled and
 * some providers reject them.
 */
const setImageMimeType = (partStr: string, mimeType: string): string =>
  partStr
    .replace(
      /data:image\/[A-Za-z0-9.+-]+;base64,\{\{IMAGE\}\}/g,
      () => `data:${mimeType};base64,{{IMAGE}}`
    )
    .replace(
      /"(media_type|mime_type|mimeType)"(\s*):(\s*)"image\/[A-Za-z0-9.+-]+"/g,
      (_match, key, before, after) => `"${key}"${before}:${after}"${mimeType}"`
    );

/**
 * Recursively processes a user message template to replace placeholders for text and images.
 * @param template The user message template object.
 * @param userMessage The user's text message.
 * @param images Images to send, as base64 strings (PNG) or with their MIME type.
 * @returns The processed user message object.
 */
export function processUserMessageTemplate(
  template: any,
  userMessage: string,
  images: Array<string | ImageInput> = []
): any {
  const escapeForJson = (value: string) =>
    JSON.stringify(value ?? "").slice(1, -1);

  // A function replacer inserts the text verbatim: a string replacement would
  // treat "$&", "$'" and "$$" in the message (common in code) as patterns.
  const escapedMessage = escapeForJson(userMessage);
  const templateStr = JSON.stringify(template).replace(
    /\{\{TEXT\}\}/g,
    () => escapedMessage
  );
  const result = JSON.parse(templateStr);
  const imageInputs = images.map(toImageInput);

  const imageReplacer = (node: any): any => {
    if (Array.isArray(node)) {
      const imageTemplateIndex = node.findIndex((item) =>
        JSON.stringify(item).includes("{{IMAGE}}")
      );

      if (imageTemplateIndex > -1) {
        const imageTemplate = node[imageTemplateIndex];
        const imageParts =
          imageInputs.length > 0
            ? imageInputs.map((img) => {
                const partStr = setImageMimeType(
                  JSON.stringify(imageTemplate),
                  img.mimeType
                ).replace(/\{\{IMAGE\}\}/g, () => img.data);
                return JSON.parse(partStr);
              })
            : [];

        const finalArray = [
          ...node.slice(0, imageTemplateIndex),
          ...imageParts,
          ...node.slice(imageTemplateIndex + 1),
        ];
        return finalArray.map(imageReplacer);
      }
      return node.map(imageReplacer);
    } else if (node && typeof node === "object") {
      const newNode: { [key: string]: any } = {};
      for (const key in node) {
        newNode[key] = imageReplacer(node[key]);
      }
      return newNode;
    }
    return node;
  };

  return imageReplacer(result);
}

/**
 * Builds a dynamic messages array from a template, incorporating history and the current user message.
 * @param messagesTemplate The message template array from the cURL configuration.
 * @param history An array of previous messages in the conversation.
 * @param userMessage The user's current text message.
 * @param images Images for the current message (base64 PNG, or with their MIME type).
 * @returns The fully constructed messages array.
 */
export function buildDynamicMessages(
  messagesTemplate: any[],
  history: Message[],
  userMessage: string,
  images: Array<string | ImageInput> = []
): any[] {
  const userMessageTemplateIndex = messagesTemplate.findIndex((m) =>
    JSON.stringify(m).includes("{{TEXT}}")
  );

  if (userMessageTemplateIndex === -1) {
    return [...history, { role: "user", content: userMessage }]; // Fallback
  }

  const prefixMessages = messagesTemplate.slice(0, userMessageTemplateIndex);
  const suffixMessages = messagesTemplate.slice(userMessageTemplateIndex + 1);
  const userMessageTemplate = messagesTemplate[userMessageTemplateIndex];

  const newUserMessage = processUserMessageTemplate(
    userMessageTemplate,
    userMessage,
    images
  );

  return [...prefixMessages, ...history, newUserMessage, ...suffixMessages];
}

/**
 * Recursively walks through an object and replaces variable placeholders.
 * @param node The object or value to process.
 * @param variables A key-value map of variables to replace.
 * @returns The processed object.
 */
export function deepVariableReplacer(
  node: any,
  variables: Record<string, string>
): any {
  if (typeof node === "string") {
    let result = node;
    for (const [key, value] of Object.entries(variables)) {
      // Function replacer: "$" in a value (API key, prompt) is taken literally.
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), () => value);
    }
    return result;
  }
  if (Array.isArray(node)) {
    return node.map((item) => deepVariableReplacer(item, variables));
  }
  if (node && typeof node === "object") {
    const newNode: { [key: string]: any } = {};
    for (const key in node) {
      newNode[key] = deepVariableReplacer(node[key], variables);
    }
    return newNode;
  }
  return node;
}

/**
 * Extracts content from a streaming API response chunk by trying a series of common JSON paths.
 * This makes the system more resilient to variations in streaming formats.
 * @param chunk The parsed JSON object from a stream line.
 * @param defaultPath The default, non-streaming content path for the provider.
 * @returns The extracted text content, or null if not found.
 */
export function getStreamingContent(
  chunk: any,
  defaultPath: string
): string | null {
  // A set of possible paths to check for streaming content.
  // Using a Set automatically handles duplicates.
  const possiblePaths = new Set([
    // 1. First, try a common modification for OpenAI-like providers.
    defaultPath.replace(".message.", ".delta."),
    // 2. Then, add other common patterns.
    "choices[0].delta.content", // OpenAI, Groq, Mistral, Perplexity
    "candidates[0].content.parts[0].text", // Gemini
    "delta.text", // Claude
    "text", // Cohere
    // 3. Finally, use the original path as a fallback (for Gemini and others).
    defaultPath,
  ]);

  for (const path of possiblePaths) {
    // Skip empty or null paths
    if (!path) continue;

    const content = getByPath(chunk, path);

    // We only care about non-empty string content.
    // Some paths might resolve to objects (e.g., `choices[0].delta`), so we check the type.
    if (typeof content === "string" && content) {
      return content;
    }
  }

  // Return null if no content is found after trying all paths.
  return null;
}
