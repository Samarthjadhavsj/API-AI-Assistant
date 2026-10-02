import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachedFile } from "@/types/completion";
import migrationSql from "../../../src-tauri/src/db/migrations/message-attachments.sql?raw";
import migrationsRs from "../../../src-tauri/src/db/main.rs?raw";

const fake = vi.hoisted(() => ({
  calls: [] as Array<{ sql: string; params: unknown[] }>,
  rows: [] as unknown[],
  fail: false,
}));

vi.mock("./config", () => ({
  getDatabase: async () => ({
    execute: async (sql: string, params: unknown[] = []) => {
      if (fake.fail) throw new Error("database is locked");
      fake.calls.push({ sql, params });
      return { rowsAffected: 1 };
    },
    select: async (sql: string, params: unknown[] = []) => {
      if (fake.fail) throw new Error("database is locked");
      fake.calls.push({ sql, params });
      return fake.rows;
    },
  }),
}));
vi.mock("@/lib", () => ({ safeLocalStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }));

import { getAttachmentData, saveAttachmentData } from "./attachment-data.action";
import { deleteAllConversations, deleteConversation } from "./chat-history.action";

const image = (id: string, name: string, base64: string): AttachedFile => ({
  id,
  name,
  type: "image/jpeg",
  size: 3,
  kind: "image",
  base64,
});
const note: AttachedFile = { id: "t1", name: "notes.txt", type: "text/plain", size: 5, kind: "text", base64: "", text: "hello" };

beforeEach(() => {
  fake.calls = [];
  fake.rows = [];
  fake.fail = false;
});

describe("attachment data persistence", () => {
  it("keeps image data per conversation and message, once (text files are already saved with the message)", async () => {
    await saveAttachmentData("conv_a", "user_1", [image("img_1", "photo.jpg", "PHOTO"), note, image("img_2", "empty.jpg", "")]);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].sql).toMatch(/^INSERT OR IGNORE INTO message_attachments/);
    expect(fake.calls[0].params.slice(0, 8)).toEqual(["conv_a", "img_1", "user_1", "photo.jpg", "image/jpeg", "image", 3, "PHOTO"]);
  });

  it("loads only the requested conversation's images", async () => {
    fake.rows = [{ id: "img_1", mime_type: "image/jpeg", data: "PHOTO" }];

    const images = await getAttachmentData("conv_a");

    expect(fake.calls).toEqual([
      { sql: "SELECT id, mime_type, data FROM message_attachments WHERE conversation_id = ?", params: ["conv_a"] },
    ]);
    expect([...images]).toEqual([["img_1", { data: "PHOTO", mimeType: "image/jpeg" }]]);
  });

  it("a database failure loses nothing else and never logs image data", async () => {
    fake.fail = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await saveAttachmentData("conv_a", "user_1", [image("img_1", "photo.jpg", "SECRET_PIXELS")]);
    const images = await getAttachmentData("conv_a");

    expect(images.size).toBe(0);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("SECRET_PIXELS");
    expect(errors.mock.calls.map((call) => call[0])).toEqual([
      "Failed to keep attachment data:",
      "Failed to load attachment data:",
    ]);
    errors.mockRestore();
  });

  it("deleting a conversation removes its attachment data first", async () => {
    await deleteConversation("conv_a");

    expect(fake.calls.map((c) => [c.sql, c.params])).toEqual([
      ["DELETE FROM message_attachments WHERE conversation_id = ?", ["conv_a"]],
      ["DELETE FROM conversations WHERE id = ?", ["conv_a"]],
    ]);
  });

  it("Delete All removes all attachment data before the messages and conversations", async () => {
    await deleteAllConversations();

    expect(fake.calls.map((c) => c.sql)).toEqual([
      "DELETE FROM message_attachments",
      "DELETE FROM messages",
      "DELETE FROM conversations",
    ]);
  });
});

describe("message_attachments migration", () => {
  it("is conversation-scoped, keeps the message link, and goes with its conversation", () => {
    expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS message_attachments/);
    expect(migrationSql).toMatch(/PRIMARY KEY \(conversation_id, id\)/);
    expect(migrationSql).toMatch(/message_id TEXT NOT NULL/);
    expect(migrationSql).toMatch(/FOREIGN KEY \(conversation_id\) REFERENCES conversations\(id\) ON DELETE CASCADE/);
    expect(migrationSql).toMatch(/ON message_attachments\(conversation_id, message_id\)/);
  });

  it("is registered as a new migration after the existing ones", () => {
    expect(migrationsRs).toMatch(/version: 3,[\s\S]*message-attachments\.sql/);
  });
});
