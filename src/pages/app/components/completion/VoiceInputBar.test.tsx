import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceInputBar } from "./VoiceInputBar";

describe("VoiceInputBar workflow states", () => {
  it("renders IDLE state with input and only mic button", () => {
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

  it("renders LISTENING state with audio visualization wave and Cancel / Finish controls", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <VoiceInputBar
        uiState="listening"
        onMicClick={vi.fn()}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByTestId("audio-visualization")).toBeInTheDocument();
    expect(screen.queryByText("Listening...")).not.toBeInTheDocument();
    expect(screen.getByTitle("Cancel")).toBeInTheDocument();
    expect(screen.getByTitle("Finish")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a message…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voice input/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTitle("Finish"));
    expect(onConfirm).toHaveBeenCalledOnce();
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
