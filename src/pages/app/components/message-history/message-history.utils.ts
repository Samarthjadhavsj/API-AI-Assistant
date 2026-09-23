import moment from "moment";

const MAX_TITLE_LENGTH = 120;

/**
 * Conversation titles are the first user message verbatim and can be
 * thousands of characters long. Collapse whitespace and cap the length so a
 * single title can't blow up list rows, headers, or dialog copy.
 */
export const displayTitle = (title: string | undefined | null) => {
  const normalized = (title ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled conversation";
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
    : normalized;
};

export const pluralize = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Short, glanceable date for conversation lists: a time for today, then
 * "Yesterday", a weekday within the last week, and a plain date after that.
 */
export const formatConversationDate = (timestamp: number, now: number = Date.now()) => {
  const date = moment(timestamp);
  const today = moment(now).startOf("day");
  if (date.isSameOrAfter(today)) return date.format("h:mm A");
  if (date.isSameOrAfter(today.clone().subtract(1, "day"))) return "Yesterday";
  if (date.isSameOrAfter(today.clone().subtract(6, "days"))) return date.format("dddd");
  return date.isSame(moment(now), "year") ? date.format("MMM D") : date.format("MMM D, YYYY");
};
