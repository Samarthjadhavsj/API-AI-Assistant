import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GeminiResponseSettings, GeminiVoiceSettings } from "./GeminiSettingsSections";

type Selection = { provider: string; variables: Record<string, string> };

beforeAll(() => {
  // Radix Select uses pointer capture and scrollIntoView, which jsdom lacks.
  const proto = Element.prototype as any;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

/** Saved settings, as the app keeps them between launches. */
let storage: { ai: Selection; stt: Selection };

beforeEach(() => {
  storage = {
    ai: { provider: "gemini", variables: { api_key: "ai-key", model: "gemini-3.5-flash-lite" } },
    stt: { provider: "gemini-transcribe", variables: { api_key: "voice-key", model: "gemini-3.5-transcribe-live" } },
  };
});

const Harness = () => {
  const [ai, setAi] = useState(storage.ai);
  const [stt, setStt] = useState(storage.stt);
  return (
    <>
      <GeminiResponseSettings
        variables={ai.variables}
        onChange={(variables) => {
          const next = { ...ai, variables };
          storage.ai = next;
          setAi(next);
        }}
        isActive
      />
      <GeminiVoiceSettings
        variables={stt.variables}
        onChange={(variables) => {
          const next = { ...stt, variables };
          storage.stt = next;
          setStt(next);
        }}
        isActive
      />
    </>
  );
};

type User = ReturnType<typeof userEvent.setup>;

const aiSelect = () => screen.getByRole("combobox", { name: "Model" });
const voiceSelect = () => screen.getByRole("combobox", { name: "Voice model" });

const openOptions = async (user: User, trigger: HTMLElement) => {
  await user.click(trigger);
  return screen.findByRole("listbox");
};

/** Option names in display order, with each one's quota label. */
const optionRows = (listbox: HTMLElement) =>
  within(listbox)
    .getAllByRole("option")
    .map((option) => [
      option.querySelector(".font-medium")?.textContent,
      option.querySelector("[data-quota]")?.textContent ?? null,
    ]);

const choose = async (user: User, trigger: HTMLElement, name: string) => {
  const listbox = await openOptions(user, trigger);
  const option = within(listbox)
    .getAllByRole("option")
    .find((o) => o.querySelector(".font-medium")?.textContent === name);
  if (!option) throw new Error(`no option ${name}`);
  await user.click(option);
};

describe("AI Response model dropdown", () => {
  it("lists models in quota order with their limits, then Custom model last", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const listbox = await openOptions(user, aiSelect());

    expect(optionRows(listbox)).toEqual([
      ["Gemini 3.5 Flash Lite", "500 requests/day"],
      ["Gemini 3.1 Flash Lite", "500 requests/day"],
      ["Gemini 2.5 Flash", "20 requests/day"],
      ["Gemini 3 Flash", "20 requests/day"],
      ["Gemini 3.5 Flash", "20 requests/day"],
      ["Gemini 3.8 Flash", "20 requests/day"],
      ["Custom model", null],
    ]);
    expect(within(listbox).getByText("Most requests per day first")).toBeInTheDocument();
  });

  it("keeps Custom model visually separated below the listed models", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const listbox = await openOptions(user, aiSelect());
    const separator = listbox.querySelector("[data-slot=select-separator]")!;
    const options = within(listbox).getAllByRole("option");

    expect(separator).not.toBeNull();
    expect(options[options.length - 2].compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(separator.compareDocumentPosition(options[options.length - 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the saved model with its quota", () => {
    render(<Harness />);

    expect(aiSelect()).toHaveTextContent("Gemini 3.5 Flash Lite");
    expect(aiSelect()).toHaveTextContent("500 requests/day");
  });

  it("saves the chosen model ID and keeps the API key", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Gemini 3 Flash");

    expect(storage.ai).toEqual({
      provider: "gemini",
      variables: { api_key: "ai-key", model: "gemini-3-flash-preview" },
    });
    expect(aiSelect()).toHaveTextContent("Gemini 3 Flash");
  });

  it("can be operated with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    aiSelect().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(storage.ai.variables.model).toBe("gemini-3.1-flash-lite");
  });
});

// These type character by character on purpose (e.g. mid-word behaviour): allow for a busy machine.
describe("Custom model", { timeout: 20_000 }, () => {
  it("reveals a model ID field and saves what's typed (trimmed)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    const input = screen.getByLabelText("Custom model ID");
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input, "  gemini-2.5-flash-lite");

    expect(storage.ai.variables.model).toBe("gemini-2.5-flash-lite");
    expect(aiSelect()).toHaveTextContent("Custom model");
  });

  it("doesn't jump to a listed model while typing an ID that starts with one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    await user.type(screen.getByLabelText("Custom model ID"), "gemini-3.5-flash-lite-exp");

    expect(aiSelect()).toHaveTextContent("Custom model");
    expect(screen.getByLabelText("Custom model ID")).toHaveValue("gemini-3.5-flash-lite-exp");
    expect(storage.ai.variables.model).toBe("gemini-3.5-flash-lite-exp");
  });

  it("follows a model changed elsewhere (e.g. another window)", () => {
    const { rerender } = render(
      <GeminiResponseSettings variables={storage.ai.variables} onChange={() => {}} isActive />
    );
    expect(aiSelect()).toHaveTextContent("Gemini 3.5 Flash Lite");

    rerender(
      <GeminiResponseSettings variables={{ ...storage.ai.variables, model: "gemini-exp" }} onChange={() => {}} isActive />
    );
    expect(aiSelect()).toHaveTextContent("Custom model");
    expect(screen.getByLabelText("Custom model ID")).toHaveValue("gemini-exp");

    rerender(
      <GeminiResponseSettings variables={{ ...storage.ai.variables, model: "gemini-3.8-flash" }} onChange={() => {}} isActive />
    );
    expect(aiSelect()).toHaveTextContent("Gemini 3.8 Flash");
    expect(screen.queryByLabelText("Custom model ID")).not.toBeInTheDocument();
  });

  it("keeps the current model in use until an ID is entered", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");

    expect(screen.getByLabelText("Custom model ID")).toHaveValue("");
    expect(screen.getByText("Enter a model ID. Gemini 3.5 Flash Lite stays in use until you do.")).toBeInTheDocument();
    expect(storage.ai.variables.model).toBe("gemini-3.5-flash-lite");
  });

  it("shows no validation error while the new custom field is simply empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    const input = screen.getByLabelText("Custom model ID");
    await waitFor(() => expect(input).toHaveFocus());

    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText(/stays in use until you do/)).not.toHaveClass("text-destructive");
  });

  it("flags an empty custom ID once the user leaves the field empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    const input = screen.getByLabelText("Custom model ID");
    await waitFor(() => expect(input).toHaveFocus());
    await user.tab(); // leave it empty

    expect(input).toHaveAttribute("aria-invalid", "true");
    const hint = screen.getByText("Enter a model ID to use a custom model. Gemini 3.5 Flash Lite is still in use.");
    expect(hint).toHaveClass("text-destructive");
    expect(input).toHaveAccessibleDescription(hint.textContent!);
    expect(storage.ai.variables.model).toBe("gemini-3.5-flash-lite");

    // Typing an ID clears the error
    await user.type(input, "gemini-exp");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Used exactly as entered.")).not.toHaveClass("text-destructive");
  });

  it("flags an empty custom ID when Enter is pressed or a typed ID is cleared", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    const input = screen.getByLabelText("Custom model ID");
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("aria-invalid", "true");

    await user.type(input, "abc");
    expect(input).not.toHaveAttribute("aria-invalid");
    await user.clear(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The last usable ID stays saved
    expect(storage.ai.variables.model).toBe("abc");
  });

  it("starts fresh (no error) each time Custom model is chosen again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    await waitFor(() => expect(screen.getByLabelText("Custom model ID")).toHaveFocus());
    await user.tab();
    expect(screen.getByLabelText("Custom model ID")).toHaveAttribute("aria-invalid", "true");

    await choose(user, aiSelect(), "Gemini 3 Flash");
    await choose(user, aiSelect(), "Custom model");

    expect(screen.getByLabelText("Custom model ID")).not.toHaveAttribute("aria-invalid");
  });

  it("shows the ID of the chosen listed model under the dropdown", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(within(screen.getByRole("region", { name: "Gemini" })).getByText("gemini-3.5-flash-lite")).toBeInTheDocument();
    await choose(user, aiSelect(), "Gemini 3 Flash");
    expect(aiSelect()).toHaveAccessibleDescription("Model ID: gemini-3-flash-preview");
  });

  it("restores the custom ID after switching to a listed model and back", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, aiSelect(), "Custom model");
    await user.type(screen.getByLabelText("Custom model ID"), "my-tuned-model");
    await choose(user, aiSelect(), "Gemini 3.8 Flash");
    expect(storage.ai.variables.model).toBe("gemini-3.8-flash");
    expect(screen.queryByLabelText("Custom model ID")).not.toBeInTheDocument();

    await choose(user, aiSelect(), "Custom model");

    expect(screen.getByLabelText("Custom model ID")).toHaveValue("my-tuned-model");
    expect(storage.ai.variables.model).toBe("my-tuned-model");
  });

  it("persists across a restart: a saved custom ID reopens as Custom model", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await choose(user, aiSelect(), "Custom model");
    await user.type(screen.getByLabelText("Custom model ID"), "gemini-exp-1206");
    unmount();

    render(<Harness />); // reads the saved settings again

    expect(aiSelect()).toHaveTextContent("Custom model");
    expect(screen.getByLabelText("Custom model ID")).toHaveValue("gemini-exp-1206");
    expect(storage.ai.variables.model).toBe("gemini-exp-1206");
  });

  it("keeps an existing unlisted model ID working, shown as Custom model", () => {
    storage.ai.variables.model = "gemini-2.0-flash";
    render(<Harness />);

    expect(aiSelect()).toHaveTextContent("Custom model");
    expect(screen.getByLabelText("Custom model ID")).toHaveValue("gemini-2.0-flash");
    expect(storage.ai.variables.model).toBe("gemini-2.0-flash");
  });

  it("offers a placeholder when no model is saved yet", () => {
    storage.ai.variables = { api_key: "" };
    render(<Harness />);

    expect(aiSelect()).toHaveTextContent("Choose a model");
    expect(screen.queryByLabelText("Custom model ID")).not.toBeInTheDocument();
  });
});

describe("Voice model dropdown", () => {
  it("lists Live models by tokens per minute, then Custom model last", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const listbox = await openOptions(user, voiceSelect());

    expect(optionRows(listbox)).toEqual([
      ["Gemini 2.5 Flash Native Audio Dialog", "Unlimited · 1M tokens/min"],
      ["Gemini 3 Flash Live", "Unlimited · 65K tokens/min"],
      ["Gemini 3.8 Live", "Unlimited · 65K tokens/min"],
      ["Gemini 3.8 Live Extended Thinking", "Unlimited · 65K tokens/min"],
      ["Gemini 3.5 Live Translate", "Unlimited · 20K tokens/min"],
      ["Gemini 3.5 Transcribe Live", "Unlimited · 20K tokens/min"],
      ["Custom model", null],
    ]);
    expect(within(listbox).getByText("All unlimited per day · most tokens per minute first")).toBeInTheDocument();
  });

  it("restores the saved voice model", () => {
    render(<Harness />);

    expect(voiceSelect()).toHaveTextContent("Gemini 3.5 Transcribe Live");
  });

  it("saves a chosen voice model and a custom voice model ID", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await choose(user, voiceSelect(), "Gemini 3.8 Live");
    expect(storage.stt.variables).toEqual({ api_key: "voice-key", model: "gemini-3.8-live" });

    await choose(user, voiceSelect(), "Custom model");
    await user.type(screen.getByLabelText("Custom model ID"), "gemini-live-2.5-flash");
    expect(storage.stt.variables.model).toBe("gemini-live-2.5-flash");
  });
});

describe("AI Response and Voice are independent", () => {
  it("changing the AI model leaves voice settings alone, and vice versa", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const voiceBefore = storage.stt;

    await choose(user, aiSelect(), "Gemini 2.5 Flash");
    expect(storage.stt).toBe(voiceBefore);

    const aiBefore = storage.ai;
    await choose(user, voiceSelect(), "Gemini 3.5 Live Translate");
    expect(storage.ai).toBe(aiBefore);
    expect(storage.ai.variables.model).toBe("gemini-2.5-flash");
    expect(storage.stt.variables.model).toBe("gemini-3.5-live-translate-preview");
  });

  it("each section has its own API key", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const aiCard = screen.getByRole("region", { name: "Gemini" });
    const voiceCard = screen.getByRole("region", { name: "Gemini Voice" });

    const aiKey = within(aiCard).getByLabelText("Gemini API key");
    await user.clear(aiKey);
    await user.type(aiKey, "new-ai-key");

    expect(storage.ai.variables).toEqual({ api_key: "new-ai-key", model: "gemini-3.5-flash-lite" });
    expect(storage.stt.variables.api_key).toBe("voice-key");
    expect(within(voiceCard).getByLabelText("Gemini API key")).toHaveValue("voice-key");

    await user.click(within(voiceCard).getByRole("button", { name: "Remove Gemini API key" }));
    expect(storage.stt.variables).toEqual({ api_key: "", model: "gemini-3.5-transcribe-live" });
    expect(storage.ai.variables.api_key).toBe("new-ai-key");
  });

  it("uses clear headings for both sections", () => {
    render(<Harness />);

    expect(screen.getByRole("region", { name: "Gemini" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Gemini Voice" })).toBeInTheDocument();
  });
});
