import { act, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEAR_BOTTOM_THRESHOLD, useChatAutoScroll } from "./useChatAutoScroll";

/** A fake Radix viewport whose geometry the tests control. */
const viewport = {
  el: null as HTMLDivElement | null,
  scrollHeight: 1000,
  clientHeight: 400,
  scrollTop: 600, // at the bottom
  scrollTo: vi.fn(),
};

const setupViewport = (el: HTMLDivElement | null) => {
  if (!el || viewport.el === el) return;
  viewport.el = el;
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => viewport.scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => viewport.clientHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => viewport.scrollTop,
    set: (v: number) => (viewport.scrollTop = v),
  });
  el.scrollTo = viewport.scrollTo as unknown as typeof el.scrollTo;
};

type Props = {
  isLoading?: boolean;
  contentKey?: unknown;
  conversationKey?: unknown;
  follow?: boolean;
  anchor?: "bottom" | "top";
};

const Harness = ({
  isLoading = false,
  contentKey = 0,
  conversationKey = "c1",
  follow = true,
  anchor,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useChatAutoScroll({
    scrollAreaRef: rootRef,
    isOpen: true,
    isLoading,
    contentKey,
    conversationKey,
    isFollowEnabled: () => follow,
    anchor,
  });
  return (
    <div ref={rootRef}>
      <div data-radix-scroll-area-viewport="" ref={setupViewport} />
    </div>
  );
};

/** The reader scrolls to `top` (fires a real scroll event on the viewport). */
const userScrollsTo = (top: number) => {
  viewport.scrollTop = top;
  act(() => {
    viewport.el!.dispatchEvent(new Event("scroll"));
  });
};

const lastScroll = () => viewport.scrollTo.mock.calls[viewport.scrollTo.mock.calls.length - 1]?.[0];
const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));

describe("useChatAutoScroll", () => {
  beforeEach(() => {
    viewport.el = null;
    viewport.scrollHeight = 1000;
    viewport.clientHeight = 400;
    viewport.scrollTop = 600;
    viewport.scrollTo.mockClear();
  });

  it("sending a message scrolls to the newest exchange, even if the reader was up top", async () => {
    const { rerender } = render(<Harness />);
    await nextFrame();
    userScrollsTo(0);
    viewport.scrollTo.mockClear();

    viewport.scrollHeight = 1200;
    rerender(<Harness isLoading />);

    await waitFor(() => expect(lastScroll()).toEqual({ top: 1200, behavior: "smooth" }));
  });

  it("follows streamed text while the reader is at the bottom", async () => {
    const { rerender } = render(<Harness isLoading />);
    await nextFrame();
    viewport.scrollTo.mockClear();

    viewport.scrollHeight = 1100;
    rerender(<Harness isLoading contentKey={1} />);

    await waitFor(() => expect(lastScroll()).toEqual({ top: 1100, behavior: "auto" }));
  });

  it("treats 'near the bottom' as still following", async () => {
    const { rerender } = render(<Harness isLoading />);
    await nextFrame();
    userScrollsTo(600 - (NEAR_BOTTOM_THRESHOLD - 10)); // within the threshold
    viewport.scrollTo.mockClear();

    rerender(<Harness isLoading contentKey={1} />);

    await waitFor(() => expect(viewport.scrollTo).toHaveBeenCalled());
  });

  it("does not steal the scroll position while the reader is reading older messages", async () => {
    const { rerender } = render(<Harness isLoading />);
    await nextFrame();
    userScrollsTo(100); // far from the bottom
    viewport.scrollTo.mockClear();

    viewport.scrollHeight = 1300;
    rerender(<Harness isLoading contentKey={1} />);
    rerender(<Harness isLoading contentKey={2} />);
    rerender(<Harness isLoading={false} contentKey={3} />); // answer finished
    await nextFrame();

    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(100);
  });

  it("the next send brings the reader back and following resumes", async () => {
    const { rerender } = render(<Harness />);
    await nextFrame();
    userScrollsTo(100);

    rerender(<Harness isLoading />);
    await waitFor(() => expect(lastScroll()?.behavior).toBe("smooth"));
    viewport.scrollTo.mockClear();

    rerender(<Harness isLoading contentKey={1} />);
    await waitFor(() => expect(lastScroll()?.behavior).toBe("auto"));
  });

  it("with Auto-scroll off, streaming is not followed but sending still shows the newest exchange", async () => {
    const { rerender } = render(<Harness follow={false} />);
    await nextFrame();
    viewport.scrollTo.mockClear();

    rerender(<Harness follow={false} contentKey={1} />);
    await nextFrame();
    expect(viewport.scrollTo).not.toHaveBeenCalled();

    rerender(<Harness follow={false} contentKey={1} isLoading />);
    await waitFor(() => expect(lastScroll()?.behavior).toBe("smooth"));
  });

  it("loading a different conversation starts at its latest exchange", async () => {
    const { rerender } = render(<Harness />);
    await nextFrame();
    userScrollsTo(0);
    viewport.scrollTo.mockClear();

    rerender(<Harness conversationKey="c2" />);

    await waitFor(() => expect(lastScroll()).toEqual({ top: 1000, behavior: "auto" }));
  });

  describe("anchored at the top (newest-first lists)", () => {
    const top = (props: Props = {}) => <Harness anchor="top" {...props} />;

    beforeEach(() => {
      viewport.scrollTop = 0; // newest exchange in view
    });

    it("loading a conversation starts at the top", async () => {
      render(top());

      await waitFor(() => expect(lastScroll()).toEqual({ top: 0, behavior: "auto" }));
    });

    it("sending scrolls back to the top, even from older messages further down", async () => {
      const { rerender } = render(top());
      await nextFrame();
      userScrollsTo(500);
      viewport.scrollTo.mockClear();

      rerender(top({ isLoading: true }));

      await waitFor(() => expect(lastScroll()).toEqual({ top: 0, behavior: "smooth" }));
    });

    it("keeps following streamed text while the reader is near the top", async () => {
      const { rerender } = render(top({ isLoading: true }));
      await nextFrame();
      userScrollsTo(NEAR_BOTTOM_THRESHOLD - 10);
      viewport.scrollTo.mockClear();

      rerender(top({ isLoading: true, contentKey: 1 }));

      await waitFor(() => expect(lastScroll()).toEqual({ top: 0, behavior: "auto" }));
    });

    it("leaves a reader of older messages alone while the answer streams", async () => {
      const { rerender } = render(top({ isLoading: true }));
      await nextFrame();
      userScrollsTo(500);
      viewport.scrollTo.mockClear();

      rerender(top({ isLoading: true, contentKey: 1 }));
      rerender(top({ isLoading: false, contentKey: 2 }));
      await nextFrame();

      expect(viewport.scrollTo).not.toHaveBeenCalled();
      expect(viewport.scrollTop).toBe(500);
    });

    it("never scrolls towards the bottom, where the oldest messages are", async () => {
      const { rerender } = render(top());
      await nextFrame();
      rerender(top({ isLoading: true, contentKey: 1 }));
      rerender(top({ isLoading: true, contentKey: 2, conversationKey: "c2" }));
      await nextFrame();

      expect(viewport.scrollTo.mock.calls.map(([options]) => options.top)).not.toContain(1000);
      expect(viewport.scrollTo.mock.calls.every(([options]) => options.top === 0)).toBe(true);
    });
  });
});
