import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceInputBar } from "./VoiceInputBar";

describe("VoiceInputBar workflow states", () => {
  it("renders IDLE state with a textarea and only mic button", () => {
    const onMicClick = vi.fn();
    render(
      <VoiceInputBar
        uiState="idle"
        onMicClick={onMicClick}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText("Write a message…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument();
    expect(screen.queryByTitle("Cancel")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Finish")).not.toBeInTheDocument();
    expect(screen.queryByText("Listening...")).not.toBeInTheDocument();
    expect(screen.queryByText("Processing...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voice input/i }));
    expect(onMicClick).toHaveBeenCalledOnce();
  });

  it("renders LISTENING state with live text, audio visualization, and Cancel / Finish controls", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <VoiceInputBar
        uiState="listening"
        transcript="Words arriving live"
        onMicClick={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId("audio-visualization")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write a message…")).toHaveValue("Words arriving live");
    expect(screen.queryByText("Listening...")).not.toBeInTheDocument();
    expect(screen.getByTitle("Cancel")).toBeInTheDocument();
    expect(screen.getByTitle("Finish")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voice input/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTitle("Finish"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("grows the textarea to its content height and scrolls after the maximum height", async () => {
    const { rerender } = render(
      <VoiceInputBar
        uiState="idle"
        inputValue="short"
        onMicClick={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText("Write a message…") as HTMLTextAreaElement;
    let scrollHeight = 88;
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });

    rerender(
      <VoiceInputBar
        uiState="idle"
        inputValue="A longer message"
        onMicClick={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await waitFor(() => expect(textarea.style.height).toBe("88px"));
    expect(textarea.style.overflowY).toBe("hidden");

    scrollHeight = 240;
    rerender(
      <VoiceInputBar
        uiState="idle"
        inputValue="An even longer message"
        onMicClick={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    await waitFor(() => expect(textarea.style.height).toBe("160px"));
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("renders PROCESSING state with text and without any listening controls or mic button", () => {
    render(
      <VoiceInputBar
        uiState="processing"
        onMicClick={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Processing...")).toBeInTheDocument();
    // Listening controls must be replaced
    expect(screen.queryByTitle("Cancel")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Finish")).not.toBeInTheDocument();
    expect(screen.queryByText("Listening...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voice input/i })).not.toBeInTheDocument();
  });

  it("renders ERROR state with clear error message", () => {
    render(
      <VoiceInputBar
        uiState="error"
        errorMessage="Couldn't process voice"
        onMicClick={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Couldn't process voice")).toBeInTheDocument();
    expect(screen.queryByTitle("Cancel")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Finish")).not.toBeInTheDocument();
  });
});
