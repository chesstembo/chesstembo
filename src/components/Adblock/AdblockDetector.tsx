import React, { useEffect } from "react";

interface AdblockDetectorProps {
  onBlock?: () => void;
}

export default function AdblockDetector({ onBlock }: AdblockDetectorProps) {
  useEffect(() => {
    const bait = document.createElement("div");
    bait.className = "adsbox";
    bait.style.position = "absolute";
    bait.style.left = "-9999px";
    document.body.appendChild(bait);

    setTimeout(() => {
      const hidden =
        bait.offsetParent === null ||
        window.getComputedStyle(bait).display === "none";
      if (hidden) onBlock?.();
      bait.remove();
    }, 300);
  }, [onBlock]);

  return null;
}