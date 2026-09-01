import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeLocalStorage } from './helper';

describe('storage helper', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('safeLocalStorage', () => {
    describe('getItem', () => {
      it('should get item from localStorage', () => {
        localStorage.getItem = vi.fn().mockReturnValue('test-value');
        
        const result = safeLocalStorage.getItem('test-key');
        
        expect(result).toBe('test-value');
        expect(localStorage.getItem).toHaveBeenCalledWith('test-key');
      });

      it('should return null if localStorage throws error', () => {
        localStorage.getItem = vi.fn().mockImplementation(() => {
          throw new Error('Storage error');
        });
        
        const result = safeLocalStorage.getItem('test-key');
        
        expect(result).toBeNull();
      });

      it('should return null for non-existent key', () => {
        localStorage.getItem = vi.fn().mockReturnValue(null);
        
        const result = safeLocalStorage.getItem('non-existent');
        
        expect(result).toBeNull();
      });
    });

    describe('setItem', () => {
      it('should set item in localStorage', () => {
        localStorage.setItem = vi.fn();
        
        safeLocalStorage.setItem('test-key', 'test-value');
        
        expect(localStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
      });

      it('should handle localStorage.setItem throwing error', () => {
        localStorage.setItem = vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });
        
        // Should not throw
        expect(() => {
          safeLocalStorage.setItem('test-key', 'test-value');
        }).not.toThrow();
      });

      it('should handle storing JSON string', () => {
        localStorage.setItem = vi.fn();
        const jsonValue = JSON.stringify({ data: 'test' });
        
        safeLocalStorage.setItem('test-key', jsonValue);
        
        expect(localStorage.setItem).toHaveBeenCalledWith('test-key', jsonValue);
      });
    });

    describe('removeItem', () => {
      it('should remove item from localStorage', () => {
        localStorage.removeItem = vi.fn();
        
        safeLocalStorage.removeItem('test-key');
        
        expect(localStorage.removeItem).toHaveBeenCalledWith('test-key');
      });

      it('should handle localStorage.removeItem throwing error', () => {
        localStorage.removeItem = vi.fn().mockImplementation(() => {
          throw new Error('Storage error');
        });
        
        // Should not throw
        expect(() => {
          safeLocalStorage.removeItem('test-key');
        }).not.toThrow();
      });
    });

    // Note: safeLocalStorage doesn't have a clear() method in the actual implementation
    // These tests are removed as they test non-existent functionality

    describe('Integration scenarios', () => {
      it('should handle full read-write-remove cycle', () => {
        const key = 'test-cycle';
        const value = 'cycle-value';
        
        const mockSetItem = vi.fn();
        const mockGetItem = vi.fn().mockReturnValue(value);
        const mockRemoveItem = vi.fn();
        
        localStorage.setItem = mockSetItem;
        localStorage.getItem = mockGetItem;
        localStorage.removeItem = mockRemoveItem;
        
        safeLocalStorage.setItem(key, value);
        const retrieved = safeLocalStorage.getItem(key);
        safeLocalStorage.removeItem(key);
        
        expect(mockSetItem).toHaveBeenCalledWith(key, value);
        expect(retrieved).toBe(value);
        expect(mockRemoveItem).toHaveBeenCalledWith(key);
      });

      it('should handle quota exceeded gracefully', () => {
        const mockSetItem = vi.fn().mockImplementation(() => {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        });
        
        localStorage.setItem = mockSetItem;
        
        // Should not throw even when quota is exceeded
        expect(() => {
          safeLocalStorage.setItem('large-key', 'x'.repeat(10000000));
        }).not.toThrow();
      });

      it('should work with complex JSON objects', () => {
        const complexObject = {
          id: 'test-123',
          data: { nested: { value: 42 } },
          array: [1, 2, 3],
          timestamp: Date.now(),
        };
        
        const jsonString = JSON.stringify(complexObject);
        const mockSetItem = vi.fn();
        const mockGetItem = vi.fn().mockReturnValue(jsonString);
        
        localStorage.setItem = mockSetItem;
        localStorage.getItem = mockGetItem;
        
        safeLocalStorage.setItem('complex', jsonString);
        const retrieved = safeLocalStorage.getItem('complex');
        
        expect(retrieved).toBe(jsonString);
        const parsed = JSON.parse(retrieved!);
        expect(parsed).toEqual(complexObject);
      });
    });
  });
});
