import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AttachedFile } from "@/types/completion";
import { Files } from "./Files";

// Real Radix popover, so opening and closing behave as in the app.
vi.mock("@/components", async () => {
  const popover = await vi.importActual<typeof import("@/components/ui/popover")>(
    "@/components/ui/popover"
  );
  return {
    ...popover,
    Button: ({ children, variant: _v, size: _s, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    ScrollArea: ({ children }: any) => <div>{children}</div>,
  };
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const jpeg: AttachedFile = {
  id: "img",
  name: "holiday photo 🏖️.jpg",
  type: "image/jpeg",
  kind: "image",
  base64: "SlBFRw==",
  size: 2.5 * 1024 * 1024,
};
const code: AttachedFile = {
  id: "code",
  name: "main.rs",
  type: "text/plain",
  kind: "text",
  base64: "",
  text: "fn main() {}",
  size: 12 * 1024,
};

const Harness = ({
  initialFiles = [],
  initialNotices = [],
  open = false,
}: {
  initialFiles?: AttachedFile[];
  initialNotices?: string[];
  open?: boolean;
}) => {
  const [attachedFiles, setAttachedFiles] = useState(initialFiles);
  const [notices, setNotices] = useState(initialNotices);
  const [isOpen, setIsOpen] = useState(open);
  return (
    <>
      <button type="button">elsewhere</button>
      <output data-testid="files">{attachedFiles.map((f) => f.name).join(",")}</output>
      <Files
        {...({
          attachedFiles,
          handleFileSelect: vi.fn(),
          removeFile: (id: string) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id)),
          onRemoveAllFiles: () => setAttachedFiles([]),
          isLoading: false,
          isFilesPopoverOpen: isOpen,
          setIsFilesPopoverOpen: setIsOpen,
          attachmentNotices: notices,
          dismissAttachmentNotices: () => setNotices([]),
          isReadingAttachments: false,
        } as any)}
      />
    </>
  );
};

describe("Files (attachments panel)", () => {
  it("offers files, not just images, in the picker", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Attach files" })).toBeInTheDocument();
    const accept = screen.getByTestId("attachment-input").getAttribute("accept")!.split(",");
    expect(accept).toEqual(expect.arrayContaining([".png", ".jpg", ".webp", ".gif", ".txt", ".md", ".csv", ".json", ".ts", ".py", ".rs", ".go", ".java", ".svg"]));
    expect(accept).not.toContain(".pdf");
    expect(accept).not.toContain(".docx");
  });

  it("previews images with their real type and shows text files as a card", async () => {
    render(<Harness initialFiles={[jpeg, code]} open />);

    const img = await screen.findByRole("img", { name: jpeg.name });
    expect(img).toHaveAttribute("src", "data:image/jpeg;base64,SlBFRw==");
    // The text file is not rendered as a (broken) image
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByText("main.rs")).toBeInTheDocument();
    expect(screen.getByText("12 KB")).toBeInTheDocument();
    expect(screen.getByText("2.5 MB")).toBeInTheDocument();
    expect(screen.getByText("Attachments (2/6)")).toBeInTheDocument();
  });

  it("removes only the attachment whose remove button was clicked", async () => {
    const user = userEvent.setup();
    render(<Harness initialFiles={[jpeg, code]} open />);

    await user.click(await screen.findByRole("button", { name: "Remove main.rs" }));

    expect(screen.getByTestId("files").textContent).toBe(jpeg.name);
  });

  it("shows why files weren't attached, even when nothing was attached", async () => {
    const user = userEvent.setup();
    render(<Harness initialNotices={["report.pdf: PDFs aren't supported yet."]} />);

    // With notices waiting, Attach opens the panel rather than the picker
    await user.click(screen.getByRole("button", { name: "Attach files" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("report.pdf: PDFs aren't supported yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove All Files/ })).toBeDisabled();
  });

  it("clears the notices once the panel is closed", async () => {
    const user = userEvent.setup();
    render(<Harness initialFiles={[code]} initialNotices={["a.bin: this file type isn't supported."]} open />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Attach files" }));

    expect(await screen.findByText("Attachments (1/6)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
