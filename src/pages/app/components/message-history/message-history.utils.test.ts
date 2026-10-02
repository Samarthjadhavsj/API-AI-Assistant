import { describe, expect, it } from "vitest";
import type { ChatConversation, ChatMessage } from "@/types/completion";
import {
  exchangesNewestFirst,
  lastActivityAt,
  sortConversationsByRecent,
} from "./message-history.utils";

const msg = (id: string, role: "user" | "assistant", timestamp: number): ChatMessage => ({
  id,
  role,
  content: id,
  timestamp,
});

/** A conversation whose messages are stored oldest → newest, like the DB returns them. */
const conv = (id: string, messageTimes: number[], updatedAt = Math.max(...messageTimes)): ChatConversation => ({
  id,
  title: id,
  createdAt: messageTimes[0],
  updatedAt,
  messages: messageTimes.map((t, i) => msg(`${id}-m${i}`, i % 2 === 0 ? "user" : "assistant", t)),
});

const ids = (list: ChatConversation[]) => list.map((c) => c.id);

describe("sortConversationsByRecent", () => {
  const oldest = conv("oldest", [100, 101]);
  const middle = conv("middle", [200, 201]);
  const newest = conv("newest", [300, 301]);

  it("puts the most recently updated conversation first", () => {
    expect(ids(sortConversationsByRecent([oldest, newest, middle]))[0]).toBe("newest");
  });

  it("puts the oldest conversation last", () => {
    const sorted = sortConversationsByRecent([newest, oldest, middle]);
    expect(ids(sorted)).toEqual(["newest", "middle", "oldest"]);
    expect(sorted[sorted.length - 1].id).toBe("oldest");
  });

  it("moves an older conversation to the top once it gets a new message", () => {
    const before = sortConversationsByRecent([newest, middle, oldest]);
    expect(ids(before)).toEqual(["newest", "middle", "oldest"]);

    // A new exchange in the oldest conversation (as the DB returns it after refresh)
    const updatedOldest = conv("oldest", [100, 101, 400, 401]);
    const after = sortConversationsByRecent([newest, middle, updatedOldest]);

    expect(ids(after)).toEqual(["oldest", "newest", "middle"]);
  });

  it("orders by the newest message even if the stored updatedAt lags behind", () => {
    const stale = conv("stale", [150, 500], 150); // updatedAt drifted below its newest message
    expect(ids(sortConversationsByRecent([newest, stale]))).toEqual(["stale", "newest"]);
    expect(lastActivityAt(stale)).toBe(500);
  });

  it("breaks timestamp ties deterministically, whatever the input order", () => {
    const a = conv("conv_a", [700]);
    const b = conv("conv_b", [700]);
    const c = conv("conv_c", [700]);

    const orders = [
      [a, b, c],
      [c, b, a],
      [b, a, c],
      [c, a, b],
    ].map((input) => ids(sortConversationsByRecent(input)));

    for (const order of orders) expect(order).toEqual(orders[0]);
    expect(orders[0]).toEqual(["conv_c", "conv_b", "conv_a"]);
  });

  it("does not mutate the input or reorder any conversation's messages", () => {
    const input = [oldest, newest, middle];
    const messagesBefore = input.map((c) => c.messages.map((m) => m.id));

    const sorted = sortConversationsByRecent(input);

    expect(ids(input)).toEqual(["oldest", "newest", "middle"]);
    expect(sorted).not.toBe(input);
    // Same conversation objects, messages still oldest → newest
    for (const c of sorted) {
      const original = input.find((o) => o.id === c.id)!;
      expect(c).toBe(original);
      expect(c.messages.map((m) => m.timestamp)).toEqual(
        [...c.messages.map((m) => m.timestamp)].sort((x, y) => x - y)
      );
    }
    expect(input.map((c) => c.messages.map((m) => m.id))).toEqual(messagesBefore);
  });
});

describe("exchangesNewestFirst", () => {
  const ids = (exchanges: ReturnType<typeof exchangesNewestFirst>) =>
    exchanges.map((exchange) => exchange.messages.map((m) => m.id));

  it("puts the newest question first, its answer directly under it, older exchanges after", () => {
    const stored = [
      msg("q1", "user", 100),
      msg("a1", "assistant", 101),
      msg("q2", "user", 200),
      msg("a2", "assistant", 201),
      msg("q3", "user", 300),
      msg("a3", "assistant", 301),
    ];

    expect(ids(exchangesNewestFirst(stored))).toEqual([
      ["q3", "a3"],
      ["q2", "a2"],
      ["q1", "a1"],
    ]);
  });

  it("pairs by time even when stored out of order", () => {
    const stored = [msg("a2", "assistant", 201), msg("q1", "user", 100), msg("q2", "user", 200), msg("a1", "assistant", 101)];

    expect(ids(exchangesNewestFirst(stored))).toEqual([
      ["q2", "a2"],
      ["q1", "a1"],
    ]);
  });

  it("keeps the stored order for equal timestamps", () => {
    const stored = [msg("q1", "user", 100), msg("a1", "assistant", 100)];

    expect(ids(exchangesNewestFirst(stored))).toEqual([["q1", "a1"]]);
  });

  it("keeps an unanswered question as its own exchange and skips system messages", () => {
    const stored: ChatMessage[] = [
      { id: "s", role: "system", content: "", timestamp: 1 },
      msg("q1", "user", 100),
      msg("q2", "user", 200),
      msg("a2", "assistant", 201),
    ];

    expect(ids(exchangesNewestFirst(stored))).toEqual([["q2", "a2"], ["q1"]]);
  });

  it("never mutates or reorders the stored array", () => {
    const stored = Object.freeze([
      Object.freeze(msg("a1", "assistant", 101)),
      Object.freeze(msg("q1", "user", 100)),
    ]) as readonly ChatMessage[];

    exchangesNewestFirst(stored);

    expect(stored.map((m) => m.id)).toEqual(["a1", "q1"]);
  });
});
