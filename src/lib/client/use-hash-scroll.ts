"use client";
import { useEffect } from "react";

/** Lists load after the page, so the browser's own jump to #ID misses. Scroll once the item exists. */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    el?.scrollIntoView({ block: "center" });
  }, [ready]);
}
