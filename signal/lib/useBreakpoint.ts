"use client";

import { useEffect, useState } from "react";

export function useBreakpoint() {
  const [width, setWidth] = useState(1280);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    isNarrow: width < 800,
    isMedium: width < 1100,
    isWide: width >= 1100,
    width,
  };
}
