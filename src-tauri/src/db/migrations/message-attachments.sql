-- Image data for message attachments, so a later message in the same
-- conversation can send an earlier image to the AI again. Messages keep only
-- lightweight attachment details (name, type, size) in messages.attached_files;
-- the data lives here, scoped to its conversation and read only for the
-- conversation being continued.
CREATE TABLE IF NOT EXISTS message_attachments (
    conversation_id TEXT NOT NULL,
    id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    kind TEXT NOT NULL,
    size INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message
    ON message_attachments(conversation_id, message_id);
