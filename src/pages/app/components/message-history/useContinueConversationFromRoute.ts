import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readContinueConversationId } from "./message-history.constants";

/**
 * Applies a "Continue chat" chosen in Toggle Settings → Message History once
 * the main chat is back: hands the id to `useCompletion` through the existing
 * `conversationSelected` event, then clears the route state so it is applied
 * only once.
 *
 * Call it from a parent of the chat (App). React runs a child's effects before
 * its parent's, so `useCompletion` is already listening when this fires.
 */
export const useContinueConversationFromRoute = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const conversationId = readContinueConversationId(location.state);
  // Strict Mode re-runs effects; load each navigation's conversation once.
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId || handledKeyRef.current === location.key) return;
    handledKeyRef.current = location.key;
    window.dispatchEvent(
      new CustomEvent("conversationSelected", { detail: { id: conversationId } })
    );
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [conversationId, location.key, location.pathname, location.search, navigate]);
};
