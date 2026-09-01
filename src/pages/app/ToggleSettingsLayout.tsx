import { useEffect, useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { useApp } from "@/contexts";
import { getPlatform } from "@/lib";
import { useToggleWindowSize } from "@/hooks/useToggleWindowSize";

/** Owns the native window and interaction lifecycle for compact settings. */
const ToggleSettingsLayout = () => {
  const { resizeForView } = useToggleWindowSize();
  const { customizable } = useApp();

  useEffect(() => {
    void resizeForView("settings");
    return () => {
      void resizeForView("compact");
    };
  }, [resizeForView]);

  // The compact search bar may deliberately hide the system pointer and render
  // its own cursor. Settings is an interactive workspace, so it must always
  // use the native pointer; otherwise an invisible cursor is confusing and
  // makes controls appear broken. The data attribute creates a CSS-level guard
  // that survives child settings reloading their state or opening a portal.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.cursorPolicy = "settings";
    root.style.setProperty("--cursor-type", "default");

    return () => {
      delete root.dataset.cursorPolicy;
      const cursorType = customizable.cursor.type;
      const cursorValue =
        getPlatform() === "linux"
          ? "default"
          : cursorType === "invisible"
            ? "none"
            : cursorType;

      root.style.setProperty("--cursor-type", cursorValue);
    };
  }, [customizable.cursor.type]);

  return <Outlet />;
};

export default ToggleSettingsLayout;
