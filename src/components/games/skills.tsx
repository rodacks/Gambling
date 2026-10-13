"use client";
import {
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  MousePointer2,
  Play,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";
import { useGame } from "../provider";
import {
  Coin,
  History,
  playTone,
  ResultBanner,
  useGate,
  usePlayViewport,
} from "../shared";
import {
  FIRST_MEDAL_BONUS,
  fmt,
  MEDALS,
  REPEAT_REWARDS,
  Skill,
  SKILLS,
  skillReward,
} from "@/lib/config";
import { randomInt } from "@/lib/random";
export function SkillGame({ game }: { game: Skill }) {
  const { state, act, ready } = useGame();
  const config = SKILLS[game];
  const { busy, run } = useGate();
  const round = state.active?.game === game ? state.active : null,
    stat = state.stats[game];
  usePlayViewport(".skill-arena", round?.id);
  const [owned, setOwned] = useState<string | null>(null),
    [phase, setPhase] = useState<
      "idle" | "playing" | "waiting" | "go" | "done"
    >("idle");
  const [score, setScore] = useState(0),
    [remaining, setRemaining] = useState<number>(config.duration),
    [misses, setMisses] = useState(0),
    [target, setTarget] = useState({ x: 50, y: 50 });
  const scoreRef = useRef(0),
    missesRef = useRef(0),
    done = useRef(false),
    goAt = useRef(0),
    phaseRef = useRef(phase);
  const latest = state.history.find((h) => h.game === game);
  const live = !!round && owned === round.id;
  phaseRef.current = phase;
  const finish = async (value: number, falseStart = false) => {
    if (!round || done.current) return;
    done.current = true;
    setPhase("done");
    await act({ type: "skill-end", id: round.id, score: value, falseStart });
  };
  useEffect(() => {
    if (!round || owned !== round.id) return;
    let frame = 0,
      cancelled = false;
    const tick = () => {
      if (cancelled || done.current) return;
      if (game === "reaction") {
        if (
          Date.now() >= round.startedAt + round.delay &&
          phaseRef.current === "waiting"
        ) {
          goAt.current = performance.now();
          phaseRef.current = "go";
          setPhase("go");
        }
      } else {
        const left = Math.max(
          0,
          config.duration - (Date.now() - round.startedAt) / 1000,
        );
        setRemaining(left);
        if (left === 0) {
          void finish(scoreRef.current);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    const hidden = () => {
      if (document.hidden && !done.current) {
        done.current = true;
        setPhase("done");
        void act({ type: "abandon", id: round.id });
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [round?.id, owned, game, act, config.duration]);
  const start = () =>
    run(async () => {
      scoreRef.current = 0;
      missesRef.current = 0;
      done.current = false;
      setScore(0);
      setMisses(0);
      setRemaining(config.duration);
      setTarget({ x: 50, y: 50 });
      const next = await act({ type: "skill", game });
      if (next?.active?.game === game) {
        setOwned(next.active.id);
        const p = game === "reaction" ? "waiting" : "playing";
        phaseRef.current = p;
        setPhase(p);
      }
    });
  const tap = () => {
    if (!live || done.current) return;
    if (game === "reaction") {
      if (phaseRef.current === "waiting") {
        void finish(0, true);
      } else if (phaseRef.current === "go") {
        const ms = Math.max(1, Math.round(performance.now() - goAt.current));
        setScore(ms);
        void finish(ms);
      }
      return;
    }
    if (Date.now() >= round.startedAt + config.duration * 1000) return;
    if (game === "jitter") {
      scoreRef.current++;
      setScore(scoreRef.current);
    } else {
      missesRef.current++;
      setMisses(missesRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 1);
      setScore(scoreRef.current);
    }
  };
  const hit = (
    e: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (
      !live ||
      done.current ||
      Date.now() >= round!.startedAt + config.duration * 1000
    )
      return;
    scoreRef.current++;
    setScore(scoreRef.current);
    setTarget({ x: 12 + randomInt(77), y: 14 + randomInt(73) });
    if (state.settings.sound) playTone(850);
  };
  const keyTap = (e: KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      tap();
    }
  };
  const Icon =
    game === "jitter" ? MousePointer2 : game === "reaction" ? Zap : Crosshair;
  return (
    <>
      <div className="skill-layout">
        <div className={`skill-stage ${game} ${live ? phase : ""}`}>
          <div className="skill-scorebar">
            <div>
              <span>{game === "reaction" ? "REACCIÓN" : "PUNTUACIÓN"}</span>
              <b>
                {score}
                <small>{game === "reaction" ? "ms" : "pts"}</small>
              </b>
            </div>
            <div>
              <span>{game === "reaction" ? "RÉCORD" : "TIEMPO"}</span>
              <b>
                {game === "reaction"
                  ? stat.best
                    ? `${stat.best}`
                    : "—"
                  : remaining.toFixed(1)}
                <small>{game === "reaction" ? "ms" : "s"}</small>
              </b>
            </div>
            <div>
              <span>
                {game === "jitter"
                  ? "CPS"
                  : game === "precision"
                    ? "FALLOS"
                    : "MODO"}
              </span>
              <b>
                {game === "jitter"
                  ? (
                      score / Math.max(0.1, config.duration - remaining)
                    ).toFixed(1)
                  : game === "precision"
                    ? misses
                    : "1×"}
              </b>
            </div>
          </div>
          {round && !live ? (
            <div className="skill-arena interrupted">
              <RotateCcw size={48} />
              <h2>Desafío interrumpido</h2>
              <p>Las sesiones de habilidad no se reanudan al recargar.</p>
              <button
                className="button gold"
                onClick={() => void act({ type: "abandon", id: round.id })}
              >
                Cerrar sesión sin recompensa
              </button>
            </div>
          ) : (
            <div
              className={`skill-arena ${live ? "active-arena" : ""}`}
              role={game === "precision" ? "group" : "button"}
              tabIndex={live && game !== "precision" ? 0 : -1}
              aria-label={
                game === "reaction"
                  ? "Pulsa cuando aparezca verde"
                  : game === "jitter"
                    ? "Área de clics"
                    : "Área de precisión"
              }
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                tap();
              }}
              onKeyDown={keyTap}
            >
              {game === "precision" && live ? (
                <button
                  className="precision-target"
                  aria-label="Acertar objetivo"
                  style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    width: Math.max(36, 64 - score * 0.8),
                    height: Math.max(36, 64 - score * 0.8),
                  }}
                  onPointerDown={(e) => {
                    if (e.button === 0) hit(e);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === " " || e.key === "Enter") && !e.repeat)
                      hit(e);
                  }}
                >
                  <span />
                  <Crosshair size={24} />
                </button>
              ) : (
                <>
                  <div
                    className="arena-icon"
                    key={game === "jitter" ? score : phase}
                  >
                    <Icon size={58} strokeWidth={1.3} />
                  </div>
                  <h2>
                    {!live
                      ? phase === "done"
                        ? "Buen intento. ¿Otra ronda?"
                        : "Entra en la zona."
                      : game === "jitter"
                        ? "¡Haz clic!"
                        : phase === "waiting"
                          ? "Espera al verde…"
                          : "¡AHORA!"}
                  </h2>
                  <p>
                    {!live
                      ? config.description
                      : game === "jitter"
                        ? "Mouse, toque o barra espaciadora."
                        : phase === "waiting"
                          ? "No te adelantes."
                          : "¡Toca la pantalla!"}
                  </p>
                  {!live && (
                    <span className="arena-hint">
                      {game === "reaction"
                        ? "UNA SEÑAL. UN INSTANTE."
                        : `${config.duration} SEGUNDOS · ENTRADA GRATUITA`}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {!round && latest?.id === owned && (
            <div className="skill-inline-result">
              <div>
                <strong>{latest.label}</strong>
                <Coin value={latest.returned} sign />
              </div>
              <button
                className="button gold"
                disabled={busy}
                onClick={() => void start()}
              >
                <RotateCcw size={15} /> Otra ronda
              </button>
            </div>
          )}
          <div className="skill-stage-footer">
            <span>
              <Trophy size={15} /> Récord:{" "}
              {stat.best
                ? `${fmt(stat.best)} ${game === "reaction" ? "ms" : game === "jitter" ? "clics" : "puntos"}`
                : "Por establecer"}
            </span>
            <span>{stat.played} PARTIDAS</span>
          </div>
        </div>
        <aside className="game-controls skill-controls">
          <span className="eyebrow">SKILL LAB / GRATIS</span>
          <h2>
            {game === "jitter"
              ? "Encuentra tu ritmo."
              : game === "reaction"
                ? "En un parpadeo."
                : "Apunta más alto."}
          </h2>
          <p>
            {game === "jitter"
              ? "Suma clics durante 10 segundos. Tómate un descanso entre intentos."
              : game === "reaction"
                ? "Pulsa cuando el panel cambie a verde. Adelantarte termina el intento sin premio."
                : "Acierta objetivos durante 20 segundos. Se vuelven más pequeños. Cada fallo resta un punto, hasta un mínimo de cero."}
          </p>
          <div className="medal-list">
            {MEDALS.map((name, i) => {
              const reward = skillReward(
                game,
                config.targets[i],
                round?.medals ?? stat.medals,
              ).reward;
              return (
                <div
                  key={name}
                  className={stat.medals.includes(i) ? "medal-earned" : ""}
                >
                  <span className={`medal medal-${i}`}>
                    <Trophy size={15} />
                  </span>
                  <div>
                    <b>
                      {name}
                      {stat.medals.includes(i) ? " ✓" : ""}
                    </b>
                    <small>
                      {config.targets[i]} {config.unit}
                    </small>
                  </div>
                  <Coin value={reward} />
                </div>
              );
            })}
          </div>
          <p className="fine-print">
            Premio del nivel más alto alcanzado. Repetición:{" "}
            {REPEAT_REWARDS.join(" / ")} monedas. +{FIRST_MEDAL_BONUS} por cada
            medalla nueva; los importes de arriba ya incluyen esos bonos.
          </p>
          <button
            className="button gold wide"
            disabled={!ready || !!round || busy}
            onClick={() => void start()}
          >
            <Play size={17} />
            {round
              ? "Desafío en curso…"
              : stat.played
                ? "Volver a jugar"
                : "Comenzar desafío"}
          </button>
          <p className="fine-print">
            Cambiar de pestaña cancela el intento. Las recompensas quedan
            fijadas al comenzar.
          </p>
        </aside>
      </div>
      {!round && <ResultBanner result={latest} />}
      <History game={game} />
    </>
  );
}
