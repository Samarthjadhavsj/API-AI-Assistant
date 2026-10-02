import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useWindow", () => ({
  EXPANDED_WINDOW_HEIGHT: 600,
  isAnyPopoverOpen: () => false,
  setNativeWindowHeight: vi.fn(),
}));

import { VoiceInputBar, type VoiceUiState } from "./VoiceInputBar";

type BarProps = Parameters<typeof VoiceInputBar>[0];

const renderBar = (uiState: VoiceUiState, overrides: Partial<BarProps> = {}) => {
  const props = {
    onMicClick: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onTranslateSend: vi.fn(),
    transcript: "hola, ¿qué tal?",
    inputValue: "draft",
    ...overrides,
  };
  render(<VoiceInputBar uiState={uiState} {...props} />);
  return props;
};

const cancel = () => screen.getByRole("button", { name: "Cancel dictation" });
const confirm = () => screen.getByRole("button", { name: "Finish dictation" });
const translate = () => screen.queryByRole("button", { name: "Translate and send" });

describe("Translate & Send button", () => {
  it.each<VoiceUiState>(["idle", "error"])("is not shown when %s", (state) => {
    renderBar(state);
    expect(translate()).not.toBeInTheDocument();
  });

  it("appears while listening, beside ✕ and ✓ (in that order)", () => {
    renderBar("listening");

    const buttons = Array.from(screen.getByTestId("voice-controls").querySelectorAll("button"));
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Cancel dictation",
      "Finish dictation",
      "Translate and send",
    ]);
  });

  it("uses exactly the same button style and accessibility pattern as ✕ and ✓", () => {
    renderBar("listening");

    expect(translate()!.className).toBe(cancel().className); // ✕ also dims when disabled
    expect(translate()).toHaveClass(...confirm().className.split(" "));
    expect(translate()).toHaveAttribute("type", "button");
    expect(translate()).toHaveAttribute("title", "Translate and send");
    // Same icon treatment: one 16px icon that ignores pointer events
    const icons = [cancel(), confirm(), translate()!].map((b) => b.querySelector("svg")!);
    for (const icon of icons) expect(icon).toHaveClass("size-4", "pointer-events-none");
  });

  it("is only shown when a handler is given (other uses of the bar are unchanged)", () => {
    renderBar("listening", { onTranslateSend: undefined });
    expect(translate()).not.toBeInTheDocument();
  });

  it("click runs Translate & Send, and nothing else", () => {
    const props = renderBar("listening");

    fireEvent.click(translate()!);

    expect(props.onTranslateSend).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it("is disabled with the reason as its tooltip when translation isn't available", () => {
    const props = renderBar("listening", { translateUnavailableReason: "Add a Gemini API key in Settings → Voice Transcription to translate." });

    expect(translate()).toBeDisabled();
    expect(translate()).toHaveAttribute("title", "Add a Gemini API key in Settings → Voice Transcription to translate.");
    expect(translate()).toHaveAttribute("aria-label", "Translate and send");
    fireEvent.click(translate()!);
    expect(props.onTranslateSend).not.toHaveBeenCalled();
  });

  it("while translating: compact 'Translating…' state, spinner on this button, every button locked", () => {
    const props = renderBar("processing", { busyAction: "translate", processingLabel: "Translating…" });

    expect(screen.getByTestId("voice-controls")).toHaveTextContent("Translating…");
    expect(screen.getByRole("status")).toHaveTextContent("Translating");
    expect(translate()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("voice-translate-spinner")).toBeInTheDocument();
    expect(confirm()).not.toHaveAttribute("aria-busy");
    expect(screen.queryByTestId("voice-spinner")).not.toBeInTheDocument();
    for (const button of [cancel(), confirm(), translate()!]) expect(button).toBeDisabled();
    // Duplicate clicks do nothing
    fireEvent.click(translate()!);
    fireEvent.click(translate()!);
    expect(props.onTranslateSend).not.toHaveBeenCalled();
  });

  it("Confirm's own processing keeps its spinner on ✓ (unchanged)", () => {
    renderBar("processing");

    expect(confirm()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("voice-spinner")).toBeInTheDocument();
    expect(translate()).not.toHaveAttribute("aria-busy");
    expect(screen.getByTestId("voice-controls")).toHaveTextContent("Transcribing…");
  });

  it("retry: keeps the transcript with the three buttons enabled and says it wasn't translated", () => {
    const props = renderBar("retry", { retryMessage: "Translation failed (503). Try again." });

    expect(screen.getByRole("textbox")).toHaveValue("hola, ¿qué tal?");
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.getByTestId("voice-retry-status")).toHaveTextContent("Not translated");
    expect(screen.getByRole("status")).toHaveTextContent("Translation failed (503). Try again.");
    for (const button of [cancel(), confirm(), translate()!]) expect(button).toBeEnabled();

    fireEvent.click(translate()!);
    expect(props.onTranslateSend).toHaveBeenCalledOnce();
  });

  it("retry: Enter inserts (Confirm) and Escape discards (Cancel)", () => {
    const props = renderBar("retry");

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  describe("keyboard", () => {
    it("Tab reaches ✕, ✓ and Translate & Send in order", async () => {
      const user = userEvent.setup();
      renderBar("listening");

      cancel().focus();
      await user.tab();
      expect(confirm()).toHaveFocus();
      await user.tab();
      expect(translate()).toHaveFocus();
    });

    it("Enter or Space on the focused Translate & Send button runs it (not Confirm)", async () => {
      const user = userEvent.setup();
      const props = renderBar("listening");

      translate()!.focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");

      expect(props.onTranslateSend).toHaveBeenCalledTimes(2);
      expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it("Enter elsewhere still finishes dictation, and Escape still cancels", () => {
      const props = renderBar("listening");

      fireEvent.keyDown(window, { key: "Enter" });
      fireEvent.keyDown(window, { key: "Escape" });

      expect(props.onConfirm).toHaveBeenCalledOnce();
      expect(props.onCancel).toHaveBeenCalledOnce();
      expect(props.onTranslateSend).not.toHaveBeenCalled();
    });
  });
});
