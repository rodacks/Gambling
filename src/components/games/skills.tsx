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
import type { SkillEvent } from "@/lib/v2/skill-proof";
import type { Save } from "@/lib/engine";
export function SkillGame({ game }: { game: Skill }) {
  const { state, act, ready, online } = useGame();
  const config = SKILLS[game];
  const { busy, run } = useGate();
  const round = state.active?.game === game ? state.active : null,
    stat = state.stats[game];
  usePlayViewport(".skill-arena", round?.id);
  const [owned, setOwned] = useState<string | null>(null),
    [phase, setPhase] = useState<
      "idle" | "prepared" | "playing" | "waiting" | "go" | "done"
    >("idle");
  const [score, setScore] = useState(0),
    [remaining, setRemaining] = useState<number>(config.duration),
    [misses, setMisses] = useState(0),
    [target, setTarget] = useState({ x: 50, y: 50 }),
    [goal, setGoal] = useState(0);
  const [locked, setLocked] = useState(false),
    [pointer, setPointer] = useState({ x: 50, y: 50 }),
    [pointerMessage, setPointerMessage] = useState("");
  const arena = useRef<HTMLDivElement>(null),
    scoreRef = useRef(0),
    missesRef = useRef(0),
    done = useRef(false),
    goAt = useRef(0),
    phaseRef = useRef(phase),
    startAt = useRef<number | null>(null),
    events = useRef<SkillEvent[]>([]),
    targetIndex = useRef(0),
    targetRef = useRef(target),
    virtual = useRef({ x: 50, y: 50 }),
    firstCommit = useRef<Promise<Save | null> | null>(null),
    dimensions = useRef({ width: 600, height: 335, touch: false });
  const [sensitivity, setSensitivity] = useState(
    state.settings.sensitivity ?? 1,
  );
  const sensitivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sensitivityTimer.current) clearTimeout(sensitivityTimer.current);
    },
    [],
  );
  const changeSensitivity = (value: number) => {
    setSensitivity(value);
    if (sensitivityTimer.current) clearTimeout(sensitivityTimer.current);
    sensitivityTimer.current = setTimeout(
      () => void act({ type: "settings", settings: { sensitivity: value } }),
      250,
    );
  };
  const latest = state.history.find((h) => h.game === game),
    live = !!round && owned === round.id;
  phaseRef.current = phase;
  targetRef.current = target;
  const release = () => {
    if (document.pointerLockElement === arena.current)
      document.exitPointerLock();
  };
  const finish = async (value: number, falseStart = false) => {
    if (!round || done.current) return;
    done.current = true;
    setPhase("done");
    release();
    const begun = await firstCommit.current;
    if (!online && game !== "reaction" && begun?.active) {
      const wait = begun.active.startedAt + config.duration * 1000 - Date.now();
      if (wait > 0 && wait < 1000)
        await new Promise((r) => setTimeout(r, wait));
    }
    await act({
      type: "skill-end",
      id: round.id,
      score: value,
      falseStart,
      proof: {
        events: events.current,
        ...dimensions.current,
        elapsed: game === "reaction" ? value : config.duration * 1000,
      },
    });
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
      } else if (startAt.current !== null) {
        const left = Math.max(
          0,
          config.duration - (performance.now() - startAt.current) / 1000,
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
    const abandon = () => {
      if (!done.current) {
        done.current = true;
        setPhase("done");
        release();
        void act({ type: "abandon", id: round.id });
      }
    };
    const hidden = () => {
      if (document.hidden) abandon();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", abandon);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", abandon);
    };
  }, [round?.id, owned, game, act, config.duration]);
  useEffect(() => {
    const changed = () =>
      setLocked(document.pointerLockElement === arena.current);
    const escape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        document.pointerLockElement === arena.current
      )
        document.exitPointerLock();
    };
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== arena.current) return;
      const rect = arena.current!.getBoundingClientRect();
      virtual.current = {
        x: Math.max(
          0,
          Math.min(
            100,
            virtual.current.x +
              ((e.movementX * sensitivity) / rect.width) * 100,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            100,
            virtual.current.y +
              ((e.movementY * sensitivity) / rect.height) * 100,
          ),
        ),
      };
      setPointer({ ...virtual.current });
    };
    document.addEventListener("pointerlockchange", changed);
    document.addEventListener("keydown", escape);
    document.addEventListener("mousemove", move);
    return () => {
      document.removeEventListener("pointerlockchange", changed);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("mousemove", move);
    };
  }, [sensitivity]);
  useEffect(
    () => () => {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    [],
  );
  const start = () =>
    run(async () => {
      scoreRef.current = 0;
      missesRef.current = 0;
      done.current = false;
      startAt.current = null;
      firstCommit.current = null;
      events.current = [];
      targetIndex.current = 0;
      setScore(0);
      setMisses(0);
      setRemaining(config.duration);
      setTarget({ x: 50, y: 50 });
      virtual.current = { x: 50, y: 50 };
      setPointer({ x: 50, y: 50 });
      const next = await act({ type: "skill", game });
      if (next?.active?.game === game) {
        setOwned(next.active.id);
        const p = game === "reaction" ? "waiting" : "prepared";
        phaseRef.current = p;
        setPhase(p);
      }
    });
  const record = (x?: number, y?: number, touch = false) => {
    if (!round || !live || done.current) return false;
    const now = performance.now();
    if (startAt.current === null) {
      const rect = arena.current!.getBoundingClientRect();
      dimensions.current = { width: rect.width, height: rect.height, touch };
      startAt.current = now;
      phaseRef.current = "playing";
      setPhase("playing");
      firstCommit.current = act({ type: "skill-first", id: round.id });
    }
    const t = now - startAt.current;
    if (t >= config.duration * 1000) return false;
    // One handler per pointerdown; no click/touchstart duplication or arbitrary debounce.
    events.current.push({ t, x, y });
    return true;
  };
  const shoot = (x: number, y: number, touch = false) => {
    if (!record(x, y, touch)) return;
    const rect = arena.current!.getBoundingClientRect();
    const radius = Math.max(touch ? 44 : 36, 64 - scoreRef.current * 0.8) / 2;
    const hit =
      Math.hypot(
        x * rect.width - (targetRef.current.x / 100) * rect.width,
        y * rect.height - (targetRef.current.y / 100) * rect.height,
      ) <=
      radius + 1;
    if (hit) {
      scoreRef.current++;
      targetIndex.current++;
      const next = round?.targets?.[targetIndex.current] ?? {
        x: 12 + randomInt(77),
        y: 14 + randomInt(73),
      };
      setTarget(next);
      if (state.settings.sound) playTone(850);
    } else {
      missesRef.current++;
      setMisses(missesRef.current);
      scoreRef.current = Math.max(0, scoreRef.current - 1);
    }
    setScore(scoreRef.current);
  };
  const tap = (e?: PointerEvent) => {
    if (!live || done.current) return;
    if (game === "reaction") {
      if (phaseRef.current === "waiting") {
        events.current = [{ t: 0 }];
        void finish(0, true);
      } else if (phaseRef.current === "go") {
        const ms = Math.max(1, Math.round(performance.now() - goAt.current));
        events.current = [{ t: ms }];
        setScore(ms);
        void finish(ms);
      }
      return;
    }
    if (game === "jitter") {
      if (record()) {
        scoreRef.current++;
        setScore(scoreRef.current);
      }
    } else {
      const rect = arena.current!.getBoundingClientRect();
      shoot(
        locked
          ? virtual.current.x / 100
          : e
            ? (e.clientX - rect.left) / rect.width
            : 0.5,
        locked
          ? virtual.current.y / 100
          : e
            ? (e.clientY - rect.top) / rect.height
            : 0.5,
        e?.pointerType === "touch",
      );
    }
  };
  const hit = (
    e: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if ("clientX" in e) tap(e);
    else shoot(targetRef.current.x / 100, targetRef.current.y / 100);
  };
  const keyTap = (e: KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      tap();
    }
  };
  const capture = async () => {
    setPointerMessage("");
    if (!arena.current?.requestPointerLock) {
      setPointerMessage(
        "Tu navegador no admite captura. Puedes apuntar normalmente con mouse o toque.",
      );
      return;
    }
    try {
      await arena.current.requestPointerLock();
    } catch {
      setPointerMessage(
        "No se pudo capturar el cursor. El modo directo sigue disponible.",
      );
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
              ref={arena}
              className={`skill-arena ${live ? "active-arena" : ""} ${locked ? "pointer-locked" : ""}`}
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
                tap(e);
              }}
              onKeyDown={keyTap}
            >
              {locked && (
                <span
                  className="virtual-pointer"
                  style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
                >
                  <Crosshair size={27} />
                </span>
              )}
              {phase === "prepared" && live && game === "precision" && (
                <span className="prepared-hint">Haz clic para comenzar.</span>
              )}
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
                      : phase === "prepared"
                        ? "Haz clic para comenzar."
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
            <span>
              {game !== "reaction"
                ? `OBJETIVO: ${config.targets[goal]} · ${MEDALS[goal]}`
                : `${stat.played} PARTIDAS`}
            </span>
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
          {game !== "reaction" && (
            <label className="goal-select">
              Tu objetivo
              <select
                value={goal}
                disabled={!!round}
                onChange={(e) => setGoal(Number(e.target.value))}
              >
                {MEDALS.map((m, i) => (
                  <option key={m} value={i}>
                    {m} · {config.targets[i]} {config.unit}
                  </option>
                ))}
              </select>
            </label>
          )}
          {game === "precision" && (
            <div className="sensitivity-control">
              <label htmlFor="sensitivity">
                Sensibilidad del puntero virtual{" "}
                <b>{sensitivity.toFixed(2)}×</b>
              </label>
              <input
                id="sensitivity"
                type="range"
                min="0.25"
                max="3"
                step="0.05"
                value={sensitivity}
                onChange={(e) => changeSensitivity(Number(e.target.value))}
              />
              <button
                className="button secondary wide"
                disabled={!live}
                onClick={() => (locked ? release() : void capture())}
              >
                {locked ? "Liberar cursor (Escape)" : "Activar puntero virtual"}
              </button>
              <p className="fine-print">
                {locked
                  ? "Captura activa · Escape para salir."
                  : "Modo directo: mouse o toque. La sensibilidad solo cambia el puntero virtual."}{" "}
                Activar la captura no inicia el reloj.
              </p>
              {pointerMessage && <p role="status">{pointerMessage}</p>}
            </div>
          )}
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
              ? phase === "prepared"
                ? "Preparado · primer clic para empezar"
                : "Desafío en curso…"
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
