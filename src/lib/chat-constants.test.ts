import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MESSAGE_ID_OFFSET,
  CONVERSATION_ID_RANDOM_LENGTH,
  generateConversationId,
  generateMessageId,
  generateRequestId,
  isValidConversationId,
  isValidMessageId,
} from './chat-constants';

describe('chat-constants', () => {
  describe('Constants', () => {
    it('should have correct MESSAGE_ID_OFFSET', () => {
      expect(MESSAGE_ID_OFFSET).toBe(1);
    });

    it('should have correct CONVERSATION_ID_RANDOM_LENGTH', () => {
      expect(CONVERSATION_ID_RANDOM_LENGTH).toBe(9);
    });
  });

  describe('generateConversationId', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate conversation ID with chat prefix', () => {
      const id = generateConversationId('chat');
      expect(id).toMatch(/^conv_\d+_[a-z0-9]{9}$/);
    });

    it('should generate conversation ID with sysaudio prefix', () => {
      const id = generateConversationId('sysaudio');
      expect(id).toMatch(/^sysaudio_conv_\d+_[a-z0-9]{9}$/);
    });

    it('should default to chat source', () => {
      const id = generateConversationId();
      expect(id).toMatch(/^conv_\d+_[a-z0-9]{9}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateConversationId();
      const id2 = generateConversationId();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const now = Date.now();
      const id = generateConversationId();
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(now);
      expect(timestamp).toBeLessThanOrEqual(now + 100);
    });

    it('should have random suffix of correct length', () => {
      const id = generateConversationId();
      const random = id.split('_')[2];
      expect(random.length).toBe(CONVERSATION_ID_RANDOM_LENGTH);
    });
  });

  describe('generateMessageId', () => {
    it('should generate message ID for user', () => {
      const id = generateMessageId('user');
      expect(id).toMatch(/^msg_\d+_user$/);
    });

    it('should generate message ID for assistant', () => {
      const id = generateMessageId('assistant');
      expect(id).toMatch(/^msg_\d+_assistant$/);
    });

    it('should generate message ID for system', () => {
      const id = generateMessageId('system');
      expect(id).toMatch(/^msg_\d+_system$/);
    });

    it('should use provided timestamp', () => {
      const timestamp = 1234567890000;
      const id = generateMessageId('user', timestamp);
      expect(id).toBe('msg_1234567890000_user');
    });

    it('should use current timestamp if not provided', () => {
      const now = Date.now();
      const id = generateMessageId('user');
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(now);
    });

    it('should generate unique IDs for same role', async () => {
      const id1 = generateMessageId('user');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      const id2 = generateMessageId('user');
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateRequestId', () => {
    it('should generate request ID with correct format', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_\d+_[a-z0-9]{9}$/);
    });

    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp', () => {
      const now = Date.now();
      const id = generateRequestId();
      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(now);
    });
  });

  describe('isValidConversationId', () => {
    it('should validate correct chat conversation ID', () => {
      const id = 'conv_1696291234567_k3j9m2n4p';
      expect(isValidConversationId(id)).toBe(true);
    });

    it('should validate correct sysaudio conversation ID', () => {
      const id = 'sysaudio_conv_1696291234567_x7z2w5q8r';
      expect(isValidConversationId(id)).toBe(true);
    });

    it('should reject ID with wrong prefix', () => {
      const id = 'invalid_1696291234567_k3j9m2n4p';
      expect(isValidConversationId(id)).toBe(false);
    });

    it('should reject ID with invalid timestamp', () => {
      const id = 'conv_abc_k3j9m2n4p';
      expect(isValidConversationId(id)).toBe(false);
    });

    it('should reject ID with wrong random length', () => {
      const id = 'conv_1696291234567_k3j'; // Too short
      expect(isValidConversationId(id)).toBe(false);
    });

    it('should reject ID with uppercase in random part', () => {
      const id = 'conv_1696291234567_K3J9M2N4P';
      expect(isValidConversationId(id)).toBe(false);
    });

    it('should reject completely invalid format', () => {
      expect(isValidConversationId('random-string')).toBe(false);
      expect(isValidConversationId('')).toBe(false);
      expect(isValidConversationId('123')).toBe(false);
    });

    it('should validate generated IDs', () => {
      const chatId = generateConversationId('chat');
      const audioId = generateConversationId('sysaudio');
      expect(isValidConversationId(chatId)).toBe(true);
      expect(isValidConversationId(audioId)).toBe(true);
    });
  });

  describe('isValidMessageId', () => {
    it('should validate correct user message ID', () => {
      const id = 'msg_1696291234567_user';
      expect(isValidMessageId(id)).toBe(true);
    });

    it('should validate correct assistant message ID', () => {
      const id = 'msg_1696291234567_assistant';
      expect(isValidMessageId(id)).toBe(true);
    });

    it('should validate correct system message ID', () => {
      const id = 'msg_1696291234567_system';
      expect(isValidMessageId(id)).toBe(true);
    });

    it('should reject ID with wrong prefix', () => {
      const id = 'message_1696291234567_user';
      expect(isValidMessageId(id)).toBe(false);
    });

    it('should reject ID with invalid role', () => {
      const id = 'msg_1696291234567_invalid';
      expect(isValidMessageId(id)).toBe(false);
    });

    it('should reject ID with invalid timestamp', () => {
      const id = 'msg_abc_user';
      expect(isValidMessageId(id)).toBe(false);
    });

    it('should reject completely invalid format', () => {
      expect(isValidMessageId('random-string')).toBe(false);
      expect(isValidMessageId('')).toBe(false);
      expect(isValidMessageId('msg_user')).toBe(false);
    });

    it('should validate generated message IDs', () => {
      const userId = generateMessageId('user');
      const assistantId = generateMessageId('assistant');
      const systemId = generateMessageId('system');
      
      expect(isValidMessageId(userId)).toBe(true);
      expect(isValidMessageId(assistantId)).toBe(true);
      expect(isValidMessageId(systemId)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should create unique conversation and message IDs in sequence', () => {
      const convId = generateConversationId();
      const timestamp = Date.now();
      const userId = generateMessageId('user', timestamp);
      const assistantId = generateMessageId('assistant', timestamp + MESSAGE_ID_OFFSET);

      expect(isValidConversationId(convId)).toBe(true);
      expect(isValidMessageId(userId)).toBe(true);
      expect(isValidMessageId(assistantId)).toBe(true);
      expect(userId).not.toBe(assistantId);
    });

    it('should handle rapid ID generation', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateConversationId());
        ids.add(generateRequestId());
      }
      // All should be unique
      expect(ids.size).toBe(200);
    });
  });
});
