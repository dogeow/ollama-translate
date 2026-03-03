import { useEffect } from "react";

export function useOutsideClick(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [enabled, handler, ref]);
}
