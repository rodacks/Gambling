"use client";
import { useEffect, useState } from "react";
import { useGame } from "../provider";
/** Absolute timestamps allow casino animations to resume after reload/backgrounding. */
export function useCasinoClock(game: "racing" | "roulette", seconds: number) {
  const { state, act } = useGame();
  const round = state.active?.game === game ? state.active : null;
  const [progress, setProgress] = useState({ id: "", value: 0 });
  const duration = state.settings.reducedMotion ? 600 : seconds * 1000;
  useEffect(() => {
    if (!round) return;
    let frame = 0,
      cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const t = Math.min(1, (Date.now() - round.startedAt) / duration);
      setProgress({ id: round.id, value: t });
      if (t >= 1) {
        void act({ type: "settle", id: round.id });
      } else frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [round?.id, duration, act]);
  return {
    progress: round ? (progress.id === round.id ? progress.value : 0) : 1,
    duration,
  };
}
