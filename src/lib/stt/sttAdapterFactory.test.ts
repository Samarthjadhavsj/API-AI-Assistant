import { describe, expect, it } from "vitest";
import { createSttAdapter } from "./sttAdapterFactory";
import { GeminiBatchSttAdapter } from "./GeminiBatchSttAdapter";
import { GeminiLiveSttAdapter } from "./GeminiLiveSttAdapter";
import {
  GEMINI_TRANSCRIBE_PROVIDER_ID,
  GEMINI_TRANSCRIBE_MODEL,
  GEMINI_TRANSCRIBE_LIVE_MODEL
} from "@/config/stt.constants";
import { TYPE_PROVIDER } from "@/types";
import { GEMINI_VOICE_MODELS } from "@/config/gemini-models.constants";

describe("createSttAdapter", () => {
  const mockProvider: TYPE_PROVIDER = {
    id: GEMINI_TRANSCRIBE_PROVIDER_ID,
    name: "Gemini Transcription",
    streaming: false,
    curl: "mock-curl-command",
  };

  const mockApiKey = "test-api-key-12345";

  describe("Live model selection", () => {
    it("returns GeminiLiveSttAdapter when model is gemini-3.5-transcribe-live", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
      expect(adapter?.providerId).toBe(GEMINI_TRANSCRIBE_PROVIDER_ID);
      expect(adapter?.kind).toBe("live-websocket");
    });

    it("passes correct configuration to GeminiLiveSttAdapter", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider) as GeminiLiveSttAdapter;

      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe(GEMINI_TRANSCRIBE_PROVIDER_ID);
      // The adapter should have the API key and model internally
      expect((adapter as any).apiKey).toBe(mockApiKey);
      expect((adapter as any).model).toBe(GEMINI_TRANSCRIBE_LIVE_MODEL);
    });
  });

  describe("Batch model selection", () => {
    it("returns GeminiBatchSttAdapter when model is gemini-3.5-transcribe", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect(adapter?.providerId).toBe(GEMINI_TRANSCRIBE_PROVIDER_ID);
      expect(adapter?.kind).toBe("multipart");
    });

    it("passes correct configuration to GeminiBatchSttAdapter", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider) as GeminiBatchSttAdapter;

      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe(GEMINI_TRANSCRIBE_PROVIDER_ID);
      // Verify the adapter has correct internals (variables is private)
      expect((adapter as any).variables.api_key).toBe(mockApiKey);
      expect((adapter as any).variables.model).toBe(GEMINI_TRANSCRIBE_MODEL);
    });
  });

  describe("Fallback behavior", () => {
    it("falls back to GeminiBatchSttAdapter when no model is specified", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          // No model specified
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect(adapter?.kind).toBe("multipart");
      expect((adapter as any).variables.model).toBe(GEMINI_TRANSCRIBE_MODEL);
    });

    it("falls back to GeminiBatchSttAdapter for empty model string", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: "",
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect(adapter?.kind).toBe("multipart");
    });

    it("falls back to GeminiBatchSttAdapter for unknown model", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: "unknown-model",
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect(adapter?.kind).toBe("multipart");
    });
  });

  describe("Validation and null returns", () => {
    it("returns null when provider is undefined", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(undefined, selectedProvider);

      expect(adapter).toBeNull();
    });

    it("returns null when provider.id does not match", () => {
      const wrongProvider: TYPE_PROVIDER = {
        ...mockProvider,
        id: "wrong-provider-id",
      };

      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(wrongProvider, selectedProvider);

      expect(adapter).toBeNull();
    });

    it("returns null when selectedProvider.provider does not match", () => {
      const selectedProvider = {
        provider: "wrong-provider",
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeNull();
    });

    it("returns null when API key is missing", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
          // No api_key
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeNull();
    });

    it("returns null when API key is empty", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: "",
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeNull();
    });

    it("returns null when API key is only whitespace", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: "   ",
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeNull();
    });
  });

  describe("Model-specific behavior preservation", () => {
    it("does not normalize live model to batch model", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      // Verify we get the live adapter, not batch
      expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
      expect(adapter).not.toBeInstanceOf(GeminiBatchSttAdapter);

      // Verify the model is preserved in the adapter
      expect((adapter as any).model).toBe(GEMINI_TRANSCRIBE_LIVE_MODEL);
    });

    it("preserves batch model without modification", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_MODEL,
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      // Verify we get the batch adapter
      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect(adapter).not.toBeInstanceOf(GeminiLiveSttAdapter);

      // Verify the model is preserved
      expect((adapter as any).variables.model).toBe(GEMINI_TRANSCRIBE_MODEL);
    });
  });

  describe("Voice models from Settings", () => {
    const withModel = (model: string) => ({
      provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
      variables: { api_key: mockApiKey, model },
    });

    it.each(GEMINI_VOICE_MODELS.map((m) => [m.name, m.id]))(
      "%s uses the Live adapter with its own model ID",
      (_name, id) => {
        const adapter = createSttAdapter(mockProvider, withModel(id));

        expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
        expect((adapter as any).model).toBe(id);
        expect((adapter as any).profile).toEqual(
          GEMINI_VOICE_MODELS.find((m) => m.id === id)!.live
        );
      }
    );

    it("uses a custom Live model ID as entered", () => {
      const adapter = createSttAdapter(mockProvider, withModel("gemini-live-2.5-flash"));

      expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
      expect((adapter as any).model).toBe("gemini-live-2.5-flash");
    });

    it("sends a custom non-Live model ID to batch transcription as entered", () => {
      const adapter = createSttAdapter(mockProvider, withModel("gemini-3.6-transcribe"));

      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
      expect((adapter as any).variables.model).toBe("gemini-3.6-transcribe");
    });
  });

  describe("Edge cases", () => {
    it("handles case-sensitive model comparison correctly", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: "gemini-3.5-TRANSCRIBE-LIVE", // Different case
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      // Should fall back to batch since case doesn't match
      expect(adapter).toBeInstanceOf(GeminiBatchSttAdapter);
    });

    it("trims whitespace around a configured model instead of dropping it", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: " gemini-3.5-transcribe-live ", // With whitespace
        },
      };

      const adapter = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter).toBeInstanceOf(GeminiLiveSttAdapter);
      expect((adapter as any).model).toBe(GEMINI_TRANSCRIBE_LIVE_MODEL);
    });

    it("creates new adapter instances on each call", () => {
      const selectedProvider = {
        provider: GEMINI_TRANSCRIBE_PROVIDER_ID,
        variables: {
          api_key: mockApiKey,
          model: GEMINI_TRANSCRIBE_LIVE_MODEL,
        },
      };

      const adapter1 = createSttAdapter(mockProvider, selectedProvider);
      const adapter2 = createSttAdapter(mockProvider, selectedProvider);

      expect(adapter1).not.toBe(adapter2);
      expect(adapter1).toBeInstanceOf(GeminiLiveSttAdapter);
      expect(adapter2).toBeInstanceOf(GeminiLiveSttAdapter);
    });
  });
});
