import { describe, it, expect } from 'vitest';
import { validateCurl } from './curl-validator';

describe('curl-validator', () => {
  describe('validateCurl', () => {
    it('should validate a correct cURL command with all required variables', () => {
      const curl = `curl https://api.openai.com/v1/chat/completions \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer {{API_KEY}}" \\
        -d '{"model": "{{MODEL}}", "messages": [{"role": "user", "content": "{{TEXT}}"}]}'`;
      
      const result = validateCurl(curl, ['API_KEY', 'MODEL', 'TEXT']);
      
      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should reject command that does not start with curl', () => {
      const notCurl = 'wget https://example.com';
      
      const result = validateCurl(notCurl, []);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("The command must start with 'curl'.");
    });

    it('should detect missing required variables', () => {
      const curl = `curl https://api.example.com \\
        -H "Authorization: Bearer {{API_KEY}}"`;
      
      const result = validateCurl(curl, ['API_KEY', 'MODEL']);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('{{MODEL}}');
    });

    it('should detect multiple missing variables', () => {
      const curl = `curl https://api.example.com`;
      
      const result = validateCurl(curl, ['API_KEY', 'MODEL', 'TEXT']);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('{{API_KEY}}');
      expect(result.message).toContain('{{MODEL}}');
      expect(result.message).toContain('{{TEXT}}');
    });

    it('should handle empty curl command', () => {
      const result = validateCurl('', ['API_KEY']);
      
      expect(result.isValid).toBe(false);
    });

    it('should validate curl with no required variables', () => {
      const curl = 'curl https://api.example.com -X GET';
      
      const result = validateCurl(curl, []);
      
      expect(result.isValid).toBe(true);
    });

    it('should handle complex cURL with POST data', () => {
      const curl = `curl -X POST https://api.anthropic.com/v1/messages \\
        -H "x-api-key: {{API_KEY}}" \\
        -H "anthropic-version: 2023-06-01" \\
        -H "content-type: application/json" \\
        -d '{"model": "{{MODEL}}", "messages": [{"role": "user", "content": "{{TEXT}}"}], "max_tokens": 1024}'`;
      
      const result = validateCurl(curl, ['API_KEY', 'MODEL', 'TEXT']);
      
      expect(result.isValid).toBe(true);
    });
  });
});
