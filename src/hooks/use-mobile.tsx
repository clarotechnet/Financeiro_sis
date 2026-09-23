import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const getIsMobileSnapshot = () =>
  typeof window !== "undefined" && window.matchMedia(MOBILE_MEDIA_QUERY).matches;

const subscribeToViewport = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);

  mediaQuery.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  window.visualViewport?.addEventListener("resize", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
    window.visualViewport?.removeEventListener("resize", onStoreChange);
  };
};

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeToViewport, getIsMobileSnapshot, () => false);
}
