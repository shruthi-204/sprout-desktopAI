import { useEffect, useRef, useState } from "react";
import animations from "../utils/animations";
import spriteFrames from "../utils/spriteFrames";

// Blink is a visual overlay only — it never touches `currentAnimation`,
// so whatever base animation is playing (walk, tired, working, ...) keeps
// ticking underneath and is exactly where it left off once the blink
// clears. That's what makes "Happy -> Blink -> Happy" etc. not restart.
const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 7000;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function useBlinkOverlay(active) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });

  useEffect(() => {
    if (!active) {
      setIsBlinking(false);
      return undefined;
    }

    let scheduleTimer;
    let frameTimer;

    function scheduleNextBlink() {
      scheduleTimer = setTimeout(() => {
        if (!activeRef.current) {
          scheduleNextBlink();
          return;
        }
        playBlink();
      }, randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS));
    }

    function playBlink() {
      const frames = spriteFrames.blink ?? [];
      if (frames.length === 0) {
        scheduleNextBlink();
        return;
      }

      setIsBlinking(true);
      setFrameIndex(0);
      const duration = animations.blink?.frameDuration ?? 120;
      let i = 0;

      frameTimer = setInterval(() => {
        i += 1;
        if (i >= frames.length) {
          clearInterval(frameTimer);
          setIsBlinking(false);
          scheduleNextBlink();
          return;
        }
        setFrameIndex(i);
      }, duration);
    }

    scheduleNextBlink();

    return () => {
      clearTimeout(scheduleTimer);
      clearInterval(frameTimer);
    };
  }, [active]);

  return { isBlinking, blinkFrame: spriteFrames.blink?.[frameIndex] };
}
