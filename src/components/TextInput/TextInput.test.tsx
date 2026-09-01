import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from './index';

describe('TextInput Component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input field', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should display input value', () => {
    render(<TextInput placeholder="Enter text" value="Hello AI" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Hello AI');
  });

  it('should call onChange on text change', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'New text' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('New text');
  });

  it('should display placeholder', () => {
    const placeholder = 'Type something...';
    render(<TextInput placeholder={placeholder} value="" onChange={mockOnChange} />);
    const input = screen.getByPlaceholderText(placeholder);
    expect(input).toBeInTheDocument();
  });

  it('should display label when provided', () => {
    render(<TextInput label="Username" placeholder="Enter username" value="" onChange={mockOnChange} />);
    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();
  });

  it('should not display label when not provided', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const labels = screen.queryAllByRole('label');
    expect(labels.length).toBe(0);
  });

  it('should display error message when error prop is provided', () => {
    const errorMessage = 'This field is required';
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} error={errorMessage} />);
    const error = screen.getByText(errorMessage);
    expect(error).toBeInTheDocument();
  });

  it('should display notes when provided', () => {
    const notes = 'Enter at least 8 characters';
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} notes={notes} />);
    const notesElement = screen.getByText(notes);
    expect(notesElement).toBeInTheDocument();
  });

  it('should handle empty input', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should handle very long input', () => {
    const longText = 'a'.repeat(10000);
    render(<TextInput placeholder="Enter text" value={longText} onChange={mockOnChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(longText);
  });

  it('should handle special characters', () => {
    const specialText = '!@#$%^&*()_+{}|:"<>?[]\\;\',./`~';
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: specialText } });
    
    expect(mockOnChange).toHaveBeenCalledWith(specialText);
  });

  it('should handle unicode characters', () => {
    const unicodeText = '你好 🚀 مرحبا 🎉';
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: unicodeText } });
    
    expect(mockOnChange).toHaveBeenCalledWith(unicodeText);
  });

  it('should apply error styling when error is present', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-destructive');
  });

  it('should handle multiple onChange calls', () => {
    render(<TextInput placeholder="Enter text" value="" onChange={mockOnChange} />);
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'First' } });
    fireEvent.change(input, { target: { value: 'Second' } });
    
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenNthCalledWith(1, 'First');
    expect(mockOnChange).toHaveBeenNthCalledWith(2, 'Second');
  });
});
