import { useEffect, useRef, useState } from "react";
import animations from "../utils/animations";
import spriteFrames from "../utils/spriteFrames";

export default function useSpriteFrame(currentAnimation, onComplete) {
  const [frameIndex, setFrameIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const frames = spriteFrames[currentAnimation]?.length
    ? spriteFrames[currentAnimation]
    : spriteFrames.idle ?? [];
  const config = animations[currentAnimation] ?? animations.idle;
  const frameCount = frames.length || 1;

  useEffect(() => {
    setFrameIndex(0);
    if (frameCount <= 1) return undefined;

    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next < frameCount) return next;
        return config.loop ? 0 : prev;
      });
    }, config.frameDuration);

    return () => clearInterval(interval);
  }, [currentAnimation, frameCount, config.frameDuration, config.loop]);

  useEffect(() => {
    if (config.loop) return undefined;

    if (frameCount > 1) {
      if (frameIndex === frameCount - 1) onCompleteRef.current?.();
      return undefined;
    }

    // A one-shot animation with no dedicated art (falls back to a single
    // idle frame) still needs to finish on its own after frameDuration,
    // otherwise onComplete never fires and the caller gets stuck in this
    // animation forever.
    const timer = setTimeout(() => onCompleteRef.current?.(), config.frameDuration);
    return () => clearTimeout(timer);
  }, [currentAnimation, frameIndex, config.loop, config.frameDuration, frameCount]);

  return frames[frameIndex] ?? frames[0];
}
