import {
  buildDynamicMessages,
  deepVariableReplacer,
  extractVariables,
  getByPath,
  getStreamingContent,
  type ImageInput,
} from "./common.function";
import { Message, TYPE_PROVIDER } from "@/types";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import curl2Json from "@bany/curl-to-json";
import { getResponseSettings, RESPONSE_LENGTHS, LANGUAGES } from "@/lib";

function buildEnhancedSystemPrompt(baseSystemPrompt?: string): string {
  const responseSettings = getResponseSettings();
  const prompts: string[] = [];

  if (baseSystemPrompt) {
    prompts.push(baseSystemPrompt);
  }

  const lengthOption = RESPONSE_LENGTHS.find(
    (l) => l.id === responseSettings.responseLength
  );
  if (lengthOption?.prompt?.trim()) {
    prompts.push(lengthOption.prompt);
  }

  const languageOption = LANGUAGES.find(
    (l) => l.id === responseSettings.language
  );
  if (languageOption?.prompt?.trim()) {
    prompts.push(languageOption.prompt);
  }

  return prompts.join(" ");
}

/**
 * The provider request failed (network, HTTP error, broken stream). Thrown,
 * never yielded, so callers can't mistake the error for the AI's answer.
 */
export class AIRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AIRequestError";
  }
}

const MAX_ERROR_BODY_CHARS = 500;

export async function* fetchAIResponse(params: {
  provider: TYPE_PROVIDER | undefined;
  selectedProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  systemPrompt?: string;
  history?: Message[];
  userMessage: string;
  /** Base64 PNG images (screenshots). */
  imagesBase64?: string[];
  /** Images with their real MIME type (attached files). */
  images?: ImageInput[];
  signal?: AbortSignal;
}): AsyncIterable<string> {
  try {
    const {
      provider,
      selectedProvider,
      systemPrompt,
      history = [],
      userMessage,
      imagesBase64 = [],
      signal,
    } = params;
    const images: Array<string | ImageInput> = [
      ...(params.images ?? []),
      ...imagesBase64,
    ];

    // Check if already aborted
    if (signal?.aborted) {
      return;
    }

    const enhancedSystemPrompt = buildEnhancedSystemPrompt(systemPrompt);

    // Requests are sent directly to the configured AI provider.
    if (!provider) {
      throw new Error(`Provider not provided`);
    }
    if (!selectedProvider) {
      throw new Error(`Selected provider not provided`);
    }

    let curlJson;
    try {
      curlJson = curl2Json(provider.curl);
    } catch (error) {
      throw new Error(
        `Failed to parse curl: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    const extractedVariables = extractVariables(provider.curl);
    const requiredVars = extractedVariables.filter(
      ({ key }) => key !== "SYSTEM_PROMPT" && key !== "TEXT" && key !== "IMAGE"
    );
    for (const { key } of requiredVars) {
      if (
        !selectedProvider.variables?.[key] ||
        selectedProvider.variables[key].trim() === ""
      ) {
        throw new Error(
          `Missing required variable: ${key}. Please configure it in settings.`
        );
      }
    }

    if (!userMessage) {
      throw new Error("User message is required");
    }
    if (images.length > 0 && !provider.curl.includes("{{IMAGE}}")) {
      throw new Error(
        `Provider ${provider?.id ?? "unknown"} does not support image input`
      );
    }

    const allVariables = {
      ...Object.fromEntries(
        Object.entries(selectedProvider.variables).map(([key, value]) => [
          key.toUpperCase(),
          value,
        ])
      ),
      SYSTEM_PROMPT: enhancedSystemPrompt || "",
    };

    const template: any = curlJson.data ? JSON.parse(JSON.stringify(curlJson.data)) : {};
    const messagesKey = Object.keys(template).find((key) =>
      ["messages", "contents", "conversation", "history"].includes(key)
    );

    // A custom endpoint may take the message outside a messages list (e.g.
    // "prompt": "{{TEXT}}"). Those spots are marked in the template itself
    // and filled last, so "{{TEXT}}" inside a filled-in value (a system
    // prompt, say) and the text the user typed are both left as written.
    const TEXT_SLOT = "\u0000TEXT\u0000";
    const mapStrings = (node: any, fn: (text: string) => string): any =>
      typeof node === "string"
        ? fn(node)
        : Array.isArray(node)
          ? node.map((item) => mapStrings(item, fn))
          : node && typeof node === "object"
            ? Object.fromEntries(Object.entries(node).map(([k, v]) => [k, mapStrings(v, fn)]))
            : node;
    const isOutsideMessages = (key: string) => key !== messagesKey || !Array.isArray(template[key]);
    for (const key of Object.keys(template)) {
      if (isOutsideMessages(key)) {
        template[key] = mapStrings(template[key], (text) => text.replace(/\{\{TEXT\}\}/g, TEXT_SLOT));
      }
    }

    // Fill in the template's variables before inserting the conversation, so
    // "{{API_KEY}}" or "{{MODEL}}" typed in a message or an attached file stays
    // as written instead of being replaced with the real key or model.
    let bodyObj: any = deepVariableReplacer(template, allVariables);
    for (const key of Object.keys(bodyObj)) {
      if (isOutsideMessages(key)) {
        bodyObj[key] = mapStrings(bodyObj[key], (text) => text.split(TEXT_SLOT).join(userMessage));
      }
    }

    if (messagesKey && Array.isArray(bodyObj[messagesKey])) {
      const finalMessages = buildDynamicMessages(
        bodyObj[messagesKey],
        history,
        userMessage,
        images
      );
      
      // Fix Gemini format: convert "content" to "parts"
      if (provider?.id === "gemini" && messagesKey === "contents") {
        bodyObj[messagesKey] = finalMessages.map((msg: any) => {
          if (msg.content) {
            // Convert OpenAI format to Gemini format
            return {
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }]
            };
          }
          return msg;
        });
      } else {
        bodyObj[messagesKey] = finalMessages;
      }
    }

    // Extract URL directly from curl string to preserve query parameters
    let url = "";
    const curlUrlMatch = provider.curl.match(/curl\s+(?:-X\s+\w+\s+)?"([^"]+)"/);
    if (curlUrlMatch && curlUrlMatch[1]) {
      url = curlUrlMatch[1];
    } else {
      url = curlJson.url || "";
    }
    
    // Decode and replace variables
    url = decodeURIComponent(url);
    url = deepVariableReplacer(url, allVariables);

    // Debug logging removed

    const headers = deepVariableReplacer(curlJson.header || {}, allVariables);
    headers["Content-Type"] = "application/json";

    if (provider?.streaming) {
      if (typeof bodyObj === "object" && bodyObj !== null) {
        const streamKey = Object.keys(bodyObj).find(
          (k) => k.toLowerCase() === "stream"
        );
        if (streamKey) {
          bodyObj[streamKey] = true;
        } else {
          bodyObj.stream = true;
        }
      }
    }

    const fetchFunction = url?.includes("http") ? fetch : tauriFetch;

    let response;
    try {
      response = await fetchFunction(url, {
        method: curlJson.method || "POST",
        headers,
        body: curlJson.method === "GET" ? undefined : JSON.stringify(bodyObj),
        signal,
      });
    } catch (fetchError) {
      // Check if aborted
      if (
        signal?.aborted ||
        (fetchError instanceof Error && fetchError.name === "AbortError")
      ) {
        return; // Silently return on abort
      }
      throw new AIRequestError(
        `Network error during API request: ${
          fetchError instanceof Error ? fetchError.message : "Unknown error"
        }`
      );
    }

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = (await response.text()).trim();
      } catch {}
      if (errorText.length > MAX_ERROR_BODY_CHARS) {
        errorText = `${errorText.slice(0, MAX_ERROR_BODY_CHARS)}…`;
      }
      throw new AIRequestError(
        `API request failed: ${response.status} ${response.statusText}${
          errorText ? ` - ${errorText}` : ""
        }`,
        response.status
      );
    }

    if (!provider?.streaming) {
      let json;
      try {
        json = await response.json();
      } catch (parseError) {
        throw new AIRequestError(
          `Failed to parse non-streaming response: ${
            parseError instanceof Error ? parseError.message : "Unknown error"
          }`
        );
      }
      const content =
        getByPath(json, provider?.responseContentPath || "") || "";
      yield content;
      return;
    }

    if (!response.body) {
      throw new AIRequestError("Streaming not supported or response body missing");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      // Check if aborted
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      let readResult;
      try {
        readResult = await reader.read();
      } catch (readError) {
        // Check if aborted
        if (
          signal?.aborted ||
          (readError instanceof Error && readError.name === "AbortError")
        ) {
          return; // Silently return on abort
        }
        throw new AIRequestError(
          `Error reading stream: ${
            readError instanceof Error ? readError.message : "Unknown error"
          }`
        );
      }
      const { done, value } = readResult;
      if (done) break;

      // Check if aborted before processing
      if (signal?.aborted) {
        reader.cancel();
        return;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const trimmed = line.substring(5).trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          try {
            const parsed = JSON.parse(trimmed);
            const delta = getStreamingContent(
              parsed,
              provider?.responseContentPath || ""
            );
            if (delta) {
              yield delta;
            }
          } catch (e) {
            // Ignore parsing errors for partial JSON chunks
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    throw new Error(
      `Error in fetchAIResponse: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
