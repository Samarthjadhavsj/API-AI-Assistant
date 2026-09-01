import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  let mockClipboard: any;

  beforeEach(() => {
    mockClipboard = {
      writeText: vi.fn(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isCopied as false', () => {
    const { result } = renderHook(() => useCopyToClipboard({ text: 'test' }));
    
    expect(result.current.isCopied).toBe(false);
  });

  it('should copy text to clipboard', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const testText = 'Test text to copy';
    const { result } = renderHook(() => useCopyToClipboard({ text: testText }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith(testText);
    expect(result.current.isCopied).toBe(true);
  });

  it('should handle copy failure gracefully', async () => {
    mockClipboard.writeText.mockRejectedValue(new Error('Copy failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCopyToClipboard({ text: 'test' }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(result.current.isCopied).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });

  it('should copy empty string', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ text: '' }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('');
    expect(result.current.isCopied).toBe(true);
  });

  it('should copy multi-line text', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const multiLine = 'Line 1\nLine 2\nLine 3';
    const { result } = renderHook(() => useCopyToClipboard({ text: multiLine }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith(multiLine);
    expect(result.current.isCopied).toBe(true);
  });

  it('should copy text with special characters', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const specialText = '<script>alert("XSS")</script>';
    const { result } = renderHook(() => useCopyToClipboard({ text: specialText }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith(specialText);
    expect(result.current.isCopied).toBe(true);
  });

  it('should handle calling handleCopy multiple times', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ text: 'test' }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    expect(result.current.isCopied).toBe(true);
    
    await act(async () => {
      result.current.handleCopy();
    });
    expect(result.current.isCopied).toBe(true);
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(2);
  });

  it('should reset copied state after 2 second timeout', async () => {
    vi.useFakeTimers();
    mockClipboard.writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ text: 'test' }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(result.current.isCopied).toBe(true);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(result.current.isCopied).toBe(false);
    
    vi.useRealTimers();
  });

  it('should clear previous timeout when copying again', async () => {
    vi.useFakeTimers();
    mockClipboard.writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ text: 'test' }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Copy again before timeout completes
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(result.current.isCopied).toBe(true);
    
    // Advance to original timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Should still be copied because timeout was cleared
    expect(result.current.isCopied).toBe(true);
    
    // Advance to new timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.isCopied).toBe(false);
    
    vi.useRealTimers();
  });

  it('should copy long text', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);
    const longText = 'a'.repeat(10000);
    const { result } = renderHook(() => useCopyToClipboard({ text: longText }));
    
    await act(async () => {
      result.current.handleCopy();
    });
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith(longText);
    expect(result.current.isCopied).toBe(true);
  });

  it('should accept custom copy message', () => {
    const customMessage = 'Text copied successfully!';
    const { result } = renderHook(() => 
      useCopyToClipboard({ text: 'test', copyMessage: customMessage })
    );
    
    expect(result.current.isCopied).toBe(false);
  });
});
