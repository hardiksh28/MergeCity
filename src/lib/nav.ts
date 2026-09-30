"use client";

import { useCity } from "./store";

/**
 * One "back" for the whole app: on-screen back buttons, Esc and the phone's
 * back button all call this. Closes the top-most layer and reports whether
 * there was anything to close.
 */
export function goBack(): boolean {
  const s = useCity.getState();
  if (s.panel) {
    const stack = s.panelStack;
    if (stack.length) s.set({ panel: stack[stack.length - 1], panelStack: stack.slice(0, -1) });
    else s.set({ panel: null });
    return true;
  }
  // The 2D map can only be left when the device can show the 3D city.
  if (s.map2d && s.webgl && s.phase !== "landing") {
    s.set({ map2d: false });
    return true;
  }
  if (s.phase === "verify") {
    s.set({ phase: "join" });
    return true;
  }
  if (s.phase === "join" || s.phase === "explore" || s.phase === "movein") {
    s.set({ phase: "landing", prompt: null });
    return true;
  }
  if (s.map2d && s.webgl) {
    s.set({ map2d: false });
    return true;
  }
  return false;
}

/** True when something is open that "back" would close. */
export function canGoBack() {
  const s = useCity.getState();
  return !!s.panel || s.phase !== "landing" || (s.map2d && s.webgl);
}

/**
 * Makes the browser / Android back button close layers instead of leaving the
 * site. We keep one extra history entry while anything is open.
 */
export function installBackButton() {
  let armed = false;
  const arm = () => {
    if (!armed && canGoBack()) {
      history.pushState({ mergecity: true }, "");
      armed = true;
    }
  };
  const onPop = () => {
    armed = false;
    goBack();
    arm();
  };
  window.addEventListener("popstate", onPop);
  const unsub = useCity.subscribe(arm);
  return () => {
    window.removeEventListener("popstate", onPop);
    unsub();
  };
}
