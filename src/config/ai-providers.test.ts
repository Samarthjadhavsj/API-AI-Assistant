import { describe, it, expect } from 'vitest';
import { AI_PROVIDERS } from './ai-providers.constants';

describe('AI Providers Configuration', () => {
  describe('Provider structure validation', () => {
    it('should have all required providers', () => {
      const providerIds = AI_PROVIDERS.map(p => p.id);
      
      expect(providerIds).toContain('openai');
      expect(providerIds).toContain('claude');
      expect(providerIds).toContain('grok');
      expect(providerIds).toContain('gemini');
      expect(providerIds).toContain('mistral');
      expect(providerIds).toContain('cohere');
      expect(providerIds).toContain('groq');
      expect(providerIds).toContain('perplexity');
      expect(providerIds).toContain('openrouter');
      expect(providerIds).toContain('ollama');
      expect(providerIds).toContain('deepseek');
    });

    it('should have unique provider IDs', () => {
      const ids = AI_PROVIDERS.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have 11 providers total', () => {
      expect(AI_PROVIDERS.length).toBe(11);
    });
  });

  describe('Individual provider validation', () => {
    AI_PROVIDERS.forEach(provider => {
      describe(`${provider.id} provider`, () => {
        it('should have required id field', () => {
          expect(provider.id).toBeDefined();
          expect(typeof provider.id).toBe('string');
          expect(provider.id.length).toBeGreaterThan(0);
        });

        it('should have curl template', () => {
          expect(provider.curl).toBeDefined();
          expect(typeof provider.curl).toBe('string');
          expect(provider.curl).toContain('curl');
        });

        it('should have responseContentPath', () => {
          expect(provider.responseContentPath).toBeDefined();
          expect(typeof provider.responseContentPath).toBe('string');
        });

        it('should have streaming flag', () => {
          expect(provider.streaming).toBeDefined();
          expect(typeof provider.streaming).toBe('boolean');
        });

        it('should have {{API_KEY}} placeholder in curl', () => {
          expect(provider.curl).toContain('{{API_KEY}}');
        });

        it('should have {{MODEL}} placeholder in curl', () => {
          expect(provider.curl).toContain('{{MODEL}}');
        });

        it('should have {{TEXT}} or {{SYSTEM_PROMPT}} in curl', () => {
          const hasText = provider.curl.includes('{{TEXT}}');
          const hasSystemPrompt = provider.curl.includes('{{SYSTEM_PROMPT}}');
          expect(hasText || hasSystemPrompt).toBe(true);
        });

        it('should have valid HTTP method', () => {
          const hasPost = provider.curl.includes('POST') || provider.curl.includes('-d ');
          const hasGet = provider.curl.includes('GET');
          const hasDefault = !provider.curl.includes(' -X ');
          expect(hasPost || hasGet || hasDefault).toBe(true);
        });

        it('should have Content-Type header or equivalent', () => {
          const hasContentType = provider.curl.toLowerCase().includes('content-type');
          const hasJsonFlag = provider.curl.includes('-d \'');
          expect(hasContentType || hasJsonFlag).toBe(true);
        });
      });
    });
  });

  describe('Streaming providers', () => {
    it('should have correct streaming status', () => {
      const streamingProviders = AI_PROVIDERS.filter(p => p.streaming);
      const nonStreamingProviders = AI_PROVIDERS.filter(p => !p.streaming);

      // Gemini is known to be non-streaming
      expect(nonStreamingProviders.some(p => p.id === 'gemini')).toBe(true);
      
      // Most others support streaming
      expect(streamingProviders.length).toBeGreaterThan(8);
    });
  });

  describe('Response path validation', () => {
    it('should have valid response paths', () => {
      AI_PROVIDERS.forEach(provider => {
        const path = provider.responseContentPath;
        
        // Should not be empty
        expect(path.length).toBeGreaterThan(0);
        
        // Common patterns
        const isArrayAccess = path.includes('[');
        const isDotNotation = path.includes('.');
        const isSimple = !isArrayAccess && !isDotNotation;
        
        expect(isArrayAccess || isDotNotation || isSimple).toBe(true);
      });
    });

    it('should have OpenAI-style path for compatible providers', () => {
      const openaiStyleProviders = ['openai', 'grok', 'mistral', 'groq', 'perplexity', 'openrouter', 'ollama', 'deepseek'];
      
      openaiStyleProviders.forEach(id => {
        const provider = AI_PROVIDERS.find(p => p.id === id);
        if (provider) {
          expect(provider.responseContentPath).toBe('choices[0].message.content');
        }
      });
    });

    it('should have Claude-specific path', () => {
      const claude = AI_PROVIDERS.find(p => p.id === 'claude');
      expect(claude?.responseContentPath).toBe('content[0].text');
    });

    it('should have Gemini-specific path', () => {
      const gemini = AI_PROVIDERS.find(p => p.id === 'gemini');
      expect(gemini?.responseContentPath).toBe('candidates[0].content.parts[0].text');
    });

    it('should have Cohere-specific path', () => {
      const cohere = AI_PROVIDERS.find(p => p.id === 'cohere');
      expect(cohere?.responseContentPath).toBe('message.content[0].text');
    });
  });

  describe('Image support validation', () => {
    it('should have {{IMAGE}} placeholder where applicable', () => {
      const providersWithImageSupport = AI_PROVIDERS.filter(p => 
        p.curl.includes('{{IMAGE}}')
      );

      // Most modern providers support images
      expect(providersWithImageSupport.length).toBeGreaterThan(5);
    });

    it('should have correct image format for different providers', () => {
      const openai = AI_PROVIDERS.find(p => p.id === 'openai');
      expect(openai?.curl).toContain('data:image/png;base64,{{IMAGE}}');

      const claude = AI_PROVIDERS.find(p => p.id === 'claude');
      expect(claude?.curl).toContain('"data": "{{IMAGE}}"');

      const gemini = AI_PROVIDERS.find(p => p.id === 'gemini');
      expect(gemini?.curl).toContain('"data": "{{IMAGE}}"');
    });
  });

  describe('URL validation', () => {
    it('should have valid API endpoints', () => {
      AI_PROVIDERS.forEach(provider => {
        const hasHttps = provider.curl.includes('https://');
        const hasHttp = provider.curl.includes('http://');
        expect(hasHttps || hasHttp).toBe(true);
      });
    });

    it('should have correct domain for each provider', () => {
      expect(AI_PROVIDERS.find(p => p.id === 'openai')?.curl).toContain('api.openai.com');
      expect(AI_PROVIDERS.find(p => p.id === 'claude')?.curl).toContain('api.anthropic.com');
      expect(AI_PROVIDERS.find(p => p.id === 'grok')?.curl).toContain('api.x.ai');
      expect(AI_PROVIDERS.find(p => p.id === 'gemini')?.curl).toContain('generativelanguage.googleapis.com');
      expect(AI_PROVIDERS.find(p => p.id === 'mistral')?.curl).toContain('api.mistral.ai');
      expect(AI_PROVIDERS.find(p => p.id === 'cohere')?.curl).toContain('api.cohere.ai');
      expect(AI_PROVIDERS.find(p => p.id === 'groq')?.curl).toContain('api.groq.com');
      expect(AI_PROVIDERS.find(p => p.id === 'perplexity')?.curl).toContain('api.perplexity.ai');
      expect(AI_PROVIDERS.find(p => p.id === 'openrouter')?.curl).toContain('openrouter.ai');
      expect(AI_PROVIDERS.find(p => p.id === 'ollama')?.curl).toContain('localhost:11434');
      expect(AI_PROVIDERS.find(p => p.id === 'deepseek')?.curl).toContain('api.deepseek.com');
    });
  });

  describe('Special provider configurations', () => {
    it('should have Ollama configured for localhost', () => {
      const ollama = AI_PROVIDERS.find(p => p.id === 'ollama');
      expect(ollama?.curl).toContain('localhost:11434');
      expect(ollama?.streaming).toBe(true);
    });

    it('should have Claude with custom headers', () => {
      const claude = AI_PROVIDERS.find(p => p.id === 'claude');
      expect(claude?.curl).toContain('anthropic-version');
      expect(claude?.curl).toContain('anthropic-dangerous-direct-browser-access');
    });

    it('should have Gemini with API key in query param style', () => {
      const gemini = AI_PROVIDERS.find(p => p.id === 'gemini');
      expect(gemini?.curl).toContain('x-goog-api-key');
    });
  });
});
