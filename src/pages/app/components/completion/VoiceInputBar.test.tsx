import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const windowMock = vi.hoisted(() => ({
  setNativeWindowHeight: vi.fn(),
  popoverOpen: false,
}));
vi.mock("@/hooks/useWindow", () => ({
  EXPANDED_WINDOW_HEIGHT: 600,
  isAnyPopoverOpen: () => windowMock.popoverOpen,
  setNativeWindowHeight: windowMock.setNativeWindowHeight,
}));

import {
  VoiceInputBar,
  calculateVoiceWindowHeight,
  describeVoiceError,
  pushWaveSample,
  type VoiceUiState,
} from "./VoiceInputBar";

beforeAll(() => {
  // Radix Popper (used by the response-popover test) measures its anchor.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

beforeEach(() => {
  windowMock.setNativeWindowHeight.mockClear();
  windowMock.popoverOpen = false;
});

type BarProps = Parameters<typeof VoiceInputBar>[0];

const renderBar = (uiState: VoiceUiState, overrides: Partial<BarProps> = {}) => {
  const props = {
    onMicClick: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onKeyPress: vi.fn(),
    onInputChange: vi.fn(),
    transcript: "live words",
    inputValue: "hidden draft",
    ...overrides,
  };
  const view = render(<VoiceInputBar uiState={uiState} {...props} />);
  return { ...view, props, textbox: screen.queryByRole("textbox") as HTMLTextAreaElement | null };
};

const cancelButton = () => screen.getByRole("button", { name: "Cancel dictation" });
const finishButton = () => screen.getByRole("button", { name: "Finish dictation" });
const status = () => screen.getByRole("status");

describe("VoiceInputBar states", () => {
  it("idle: compact editable composer with a single ghost mic button", () => {
    const { props, textbox } = renderBar("idle");

    expect(textbox).toHaveAttribute("placeholder", "Write a message…");
    expect(textbox).toHaveValue("hidden draft");
    expect(textbox).not.toHaveAttribute("readonly");

    const mic = screen.getByRole("button", { name: "Start voice input" });
    expect(mic).toHaveClass("size-7", "rounded-full");
    expect(screen.queryByTestId("voice-controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish dictation" })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("");

    fireEvent.click(mic);
    expect(props.onMicClick).toHaveBeenCalledOnce();
  });

  it("idle: dims the mic when no provider is configured but keeps it usable", () => {
    const { props } = renderBar("idle", { isProviderConfigured: false });

    const mic = screen.getByRole("button", { name: "Start voice input" });
    expect(mic).toHaveClass("opacity-50");
    fireEvent.click(mic);
    expect(props.onMicClick).toHaveBeenCalledOnce();
  });

  it("listening: same compact bar, transcript beside wave + ✕/✓ pinned bottom-right", () => {
    const { props, textbox, container } = renderBar("listening");

    expect(textbox).toHaveValue("live words");
    expect(textbox).toHaveAttribute("readonly");
    const bar = container.querySelector("[data-voice-state=listening]")!;
    // Identical bar classes to idle: starts the same size, only grows downward
    const idle = render(
      <VoiceInputBar uiState="idle" onMicClick={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    const idleBarClasses = idle.container.querySelector("[data-voice-state=idle]")!.className;
    idle.unmount();
    expect(bar.className).toBe(idleBarClasses);
    expect(bar).not.toHaveClass("flex-col");
    expect(bar.children[0]).toContainElement(textbox);
    expect(bar.children[1]).toBe(screen.getByTestId("voice-controls"));
    expect(screen.getByTestId("voice-controls")).toHaveClass("self-end", "h-7");
    expect(status()).toHaveTextContent("Listening");
    expect(container.querySelector('[data-voice-listening="true"]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start voice input" })).not.toBeInTheDocument();

    fireEvent.click(cancelButton());
    expect(props.onCancel).toHaveBeenCalledOnce();
    fireEvent.click(finishButton());
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("listening: shows an italic 'Listening…' before any words arrive", () => {
    const { textbox } = renderBar("listening", { transcript: "" });

    expect(textbox).toHaveValue("");
    expect(textbox).toHaveAttribute("placeholder", "Listening…");
    expect(textbox).toHaveClass("placeholder:italic");
  });

  it("listening: ✕ and ✓ are matching rounded-square buttons, ✕ first", () => {
    renderBar("listening");

    for (const button of [cancelButton(), finishButton()]) {
      expect(button).toHaveClass("size-7", "rounded-lg", "bg-foreground/10");
    }
    // Same visual style; ✕ only adds a fade for its disabled (transcribing) state
    expect(cancelButton().className.replace(" disabled:opacity-40", "")).toBe(finishButton().className);
    const controls = within(screen.getByTestId("voice-controls")).getAllByRole("button");
    expect(controls).toEqual([cancelButton(), finishButton()]);
    // No extra icons or indicators beyond the wave and the two buttons
    expect(screen.queryByTestId("listening-indicator")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("voice-controls")).getAllByRole("button")).toHaveLength(2);
  });

  it("listening: the wave is a row of resting dots hidden from screen readers", () => {
    renderBar("listening");

    const wave = screen.getByTestId("audio-visualization");
    expect(wave.children).toHaveLength(12);
    for (const dot of Array.from(wave.children) as HTMLElement[]) {
      expect(dot.style.height).toBe("2px");
    }
    expect(wave.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("the wave scrolls right to left: new levels enter on the right", () => {
    let wave = [2, 2, 2, 2];
    wave = pushWaveSample(wave, 10);
    expect(wave).toEqual([2, 2, 2, 10]);
    wave = pushWaveSample(wave, 6);
    expect(wave).toEqual([2, 2, 10, 6]);
    wave = pushWaveSample(pushWaveSample(wave, 2), 2);
    expect(wave).toEqual([10, 6, 2, 2]);
    expect(pushWaveSample(wave, 4)).toHaveLength(4);
  });

  it("processing: keeps the transcript visible and dimmed with a spinner in the ✓ slot", () => {
    const { textbox } = renderBar("processing", { transcript: "everything I said" });

    expect(textbox).toHaveValue("everything I said");
    expect(textbox).toHaveAttribute("readonly");
    expect(textbox).toHaveClass("opacity-60");
    expect(screen.getByText("Transcribing…")).toBeInTheDocument();
    expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("Transcribing");

    expect(within(finishButton()).getByTestId("voice-spinner")).toBeInTheDocument();
    expect(finishButton()).toBeDisabled();
    expect(finishButton()).toHaveAttribute("aria-busy", "true");
    expect(cancelButton()).toBeVisible();
    expect(cancelButton()).toBeDisabled();
    expect(screen.queryByTestId("audio-visualization")).not.toBeInTheDocument();
  });

  it("keeps ✕/✓ as the same fixed elements from listening to processing", () => {
    const { rerender, props } = renderBar("listening", { transcript: "hello there" });
    const cancel = cancelButton();
    const finish = finishButton();

    rerender(<VoiceInputBar uiState="processing" {...props} transcript="hello there" />);

    expect(cancelButton()).toBe(cancel);
    expect(finishButton()).toBe(finish);
    expect(screen.getByRole("textbox")).toHaveValue("hello there");
  });

  it("error (no speech): friendly neutral notice in the same bar with the mic to retry", () => {
    const { props } = renderBar("error", { errorMessage: "No speech detected. Please try again." });

    const notice = screen.getByTestId("voice-notice");
    expect(notice).toHaveTextContent("Didn't catch that. Try again.");
    expect(notice).toHaveAttribute("data-tone", "neutral");
    expect(notice).toHaveClass("text-muted-foreground");
    expect(notice).not.toHaveClass("text-destructive");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
    expect(document.querySelector("[data-voice-state=error]")).not.toHaveClass("border-destructive/40");

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(props.onMicClick).toHaveBeenCalledOnce();
  });

  it("error (real failure): concise message with a subtle error tone", () => {
    renderBar("error", {
      errorMessage: "Microphone permission was denied. Allow microphone access and try again.",
    });

    const notice = screen.getByTestId("voice-notice");
    expect(notice).toHaveTextContent("Microphone access is blocked.");
    expect(notice).toHaveAttribute("data-tone", "error");
    expect(notice).toHaveClass("text-destructive");
    expect(document.querySelector("[data-voice-state=error]")).toHaveClass("border-destructive/40");
  });

  it("maps controller messages to short, friendly copy", () => {
    expect(describeVoiceError("No speech was recognized. Please try again.")).toEqual({
      text: "Didn't catch that. Try again.",
      tone: "neutral",
    });
    expect(describeVoiceError("No audio was captured. Please try again.").tone).toBe("neutral");
    expect(
      describeVoiceError("Voice input requires a Gemini API key. Add one in Settings → Voice Settings.")
    ).toEqual({ text: "Add a Gemini API key in Settings → Voice Transcription.", tone: "neutral" });
    expect(describeVoiceError("Your microphone is being used by another app. Close it and try again.").text).toBe(
      "Microphone is in use by another app."
    );
    expect(describeVoiceError("No microphone was found. Connect or select a microphone and try again.").text).toBe(
      "Microphone unavailable."
    );
    expect(describeVoiceError("Couldn't process voice")).toEqual({ text: "Couldn't process voice", tone: "error" });
    expect(
      describeVoiceError("The transcription service took too long to prepare the recording. Please try again.")
    ).toEqual({ text: "Couldn't transcribe. Try again.", tone: "error" });
    expect(describeVoiceError("")).toEqual({ text: "Couldn't transcribe. Try again.", tone: "error" });
  });

  it("uses theme colors instead of hard-coded dark values", () => {
    const { container } = renderBar("listening");
    const bar = container.querySelector("[data-voice-state]")!;

    expect(bar).toHaveClass("bg-input/30", "border-border");
    expect(bar.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(screen.getByRole("textbox")).toHaveClass("text-foreground", "placeholder:text-muted-foreground");
  });

  it("respects reduced motion on every animated element", () => {
    const listening = renderBar("listening");
    expect(screen.getByTestId("audio-visualization")).toHaveClass("motion-safe:animate-in");
    for (const bar of Array.from(screen.getByTestId("audio-visualization").children)) {
      expect(bar).toHaveClass("motion-reduce:transition-none");
    }
    expect(screen.getByRole("textbox")).toHaveClass("motion-reduce:transition-none");
    listening.unmount();

    renderBar("processing");
    for (const spinner of screen.getAllByTestId("voice-spinner")) {
      expect(spinner).toHaveClass("motion-safe:animate-spin");
      expect(spinner).not.toHaveClass("animate-spin");
    }
  });
});

describe("VoiceInputBar sizing and window height", () => {
  it("grows during listening, follows the newest words, and stays compact when idle", async () => {
    const { rerender, props } = renderBar("listening", { transcript: "short" });
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    let scrollHeight = 88;
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, get: () => scrollHeight });

    rerender(<VoiceInputBar uiState="listening" {...props} transcript="A longer message" />);
    await waitFor(() => expect(textarea.style.height).toBe("88px"));
    expect(textarea.style.overflowY).toBe("hidden");

    scrollHeight = 240;
    rerender(<VoiceInputBar uiState="listening" {...props} transcript="An even longer message" />);
    await waitFor(() => expect(textarea.style.height).toBe("160px"));
    expect(textarea.style.overflowY).toBe("auto");
    expect(textarea.scrollTop).toBe(240);

    rerender(<VoiceInputBar uiState="idle" {...props} inputValue="A confirmed multi-line transcript" />);
    await waitFor(() => {
      expect(textarea.style.height).toBe("20px");
      expect(textarea.style.overflowY).toBe("hidden");
    });
  });

  it("keeps the grown window while transcribing", async () => {
    const { rerender, props } = renderBar("listening", { transcript: "words" });
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, get: () => 60 });
    windowMock.setNativeWindowHeight.mockClear();

    rerender(<VoiceInputBar uiState="processing" {...props} transcript="words" />);

    await waitFor(() =>
      expect(windowMock.setNativeWindowHeight).toHaveBeenLastCalledWith(calculateVoiceWindowHeight(60))
    );
    expect(windowMock.setNativeWindowHeight).not.toHaveBeenCalledWith(54);
    expect(document.querySelector('[data-voice-listening="true"]')).toBeInTheDocument();
  });

  it("never resizes the window while typing in idle (no 54px collapse)", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [value, setValue] = useState("");
      return (
        <VoiceInputBar uiState="idle" inputValue={value} onInputChange={setValue} onMicClick={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} />
      );
    };
    render(<Harness />);

    await user.type(screen.getByRole("textbox"), "typing in idle");

    expect(screen.getByRole("textbox")).toHaveValue("typing in idle");
    expect(windowMock.setNativeWindowHeight).not.toHaveBeenCalled();
  });

  it.each([
    [false, 54],
    [true, 600],
  ])("when dictation ends (popover open: %s) restores the window to %ipx", async (popoverOpen, height) => {
    const { rerender, props } = renderBar("listening");
    windowMock.popoverOpen = popoverOpen;
    windowMock.setNativeWindowHeight.mockClear();

    rerender(<VoiceInputBar uiState="idle" {...props} />);

    await waitFor(() => expect(windowMock.setNativeWindowHeight).toHaveBeenCalledWith(height));
    expect(windowMock.setNativeWindowHeight).toHaveBeenCalledTimes(1);
  });

  it("calculates window height bounded between 54px and 194px", () => {
    expect(calculateVoiceWindowHeight(20)).toBe(54);
    expect(calculateVoiceWindowHeight(10)).toBe(54);
    expect(calculateVoiceWindowHeight(40)).toBe(74);
    expect(calculateVoiceWindowHeight(80)).toBe(114);
    expect(calculateVoiceWindowHeight(160)).toBe(194);
    expect(calculateVoiceWindowHeight(250)).toBe(194);
  });
});

describe("VoiceInputBar keyboard safety", () => {
  it("Enter while listening finishes dictation, wherever focus is", () => {
    const { props, textbox } = renderBar("listening");

    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(props.onConfirm).toHaveBeenCalledTimes(1);

    textbox!.focus();
    fireEvent.keyDown(textbox!, { key: "Enter" });
    expect(props.onConfirm).toHaveBeenCalledTimes(2);
  });

  it("Enter while listening never reaches the normal send handler", async () => {
    const user = userEvent.setup();
    const { props, textbox } = renderBar("listening");

    await user.click(textbox!);
    await user.keyboard("{Enter}");

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onKeyPress).not.toHaveBeenCalled();
  });

  it("Escape while listening cancels dictation", () => {
    const { props } = renderBar("listening");

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("Escape while listening does not reach the response popover's dismiss/reset", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();
    const Harness = ({ uiState }: { uiState: VoiceUiState }) => (
      <Popover open onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>
          <div>
            <VoiceInputBar uiState={uiState} onMicClick={vi.fn()} onCancel={onCancel} onConfirm={vi.fn()} />
          </div>
        </PopoverAnchor>
        <PopoverContent>AI response</PopoverContent>
      </Popover>
    );
    const { rerender } = render(<Harness uiState="listening" />);

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();

    // Sanity: once idle, Escape reaches the popover again (existing behavior).
    rerender(<Harness uiState="idle" />);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("the textarea is read-only while listening and shows the live transcript", async () => {
    const user = userEvent.setup();
    const { props, textbox } = renderBar("listening");

    expect(textbox).toHaveAttribute("readonly");
    expect(textbox).toHaveValue("live words");
    await user.type(textbox!, "xyz");
    expect(props.onInputChange).not.toHaveBeenCalled();
  });

  it("the textarea is editable when idle and Enter uses the normal send handler", async () => {
    const user = userEvent.setup();
    const { props, textbox } = renderBar("idle");

    expect(textbox).not.toHaveAttribute("readonly");
    await user.type(textbox!, "a");
    expect(props.onInputChange).toHaveBeenCalledWith("hidden drafta");
    await user.keyboard("{Enter}");
    expect(props.onKeyPress).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("Shift+Enter while listening neither finishes nor sends", async () => {
    const user = userEvent.setup();
    const { props, textbox } = renderBar("listening");

    await user.click(textbox!);
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onKeyPress).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("live words");
  });

  it("Enter during IME composition does not finish dictation", () => {
    const { props, textbox } = renderBar("listening");

    fireEvent.keyDown(textbox!, { key: "Enter", isComposing: true });
    fireEvent.keyDown(textbox!, { key: "Enter", keyCode: 229 });

    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("stops handling Enter/Escape once dictation is no longer listening", () => {
    const { props, rerender } = renderBar("listening");
    rerender(<VoiceInputBar uiState="processing" {...props} />);

    fireEvent.keyDown(document.body, { key: "Enter" });
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it.each([
    ["cancel", ["listening", "idle"]],
    ["finish", ["listening", "processing", "idle"]],
  ] as const)("returns focus to the textarea after %s", async (_label, states) => {
    const Harness = () => {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIndex((i) => i + 1)}>
            next
          </button>
          <VoiceInputBar uiState={states[index]} onMicClick={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} />
        </>
      );
    };
    render(<Harness />);
    const next = screen.getByRole("button", { name: "next" });

    for (let i = 1; i < states.length; i++) {
      next.focus();
      fireEvent.click(next);
    }

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
  });

  it("does not grab focus on first render in idle", () => {
    renderBar("idle");

    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });
});
