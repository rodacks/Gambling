"use client";
import { CSSProperties, useState } from "react";
import { RotateCw, Undo2, Trash2 } from "lucide-react";
import { useGame } from "../provider";
import {
  Coin,
  History,
  ResultBanner,
  useGate,
  usePlayViewport,
} from "../shared";
import { betLabel, color, RouletteBet, WHEEL } from "@/lib/roulette";
import { useCasinoClock } from "./use-clock";
import { cents } from "@/lib/engine";
function Wheel({
  result,
  spinning,
  duration,
}: {
  result: number;
  spinning: boolean;
  duration: number;
}) {
  const angle = 1440 + (360 - (WHEEL.indexOf(result) * 360) / 37);
  return (
    <div className="roulette-wheel">
      <div className="ball" />
      <div
        key={spinning ? `spin-${result}` : `rest-${result}`}
        className={`wheel-rotor ${spinning ? "spinning" : ""}`}
        style={
          {
            "--angle": `${angle}deg`,
            "--spin-duration": `${duration}ms`,
            transform: `rotate(${angle}deg)`,
          } as CSSProperties
        }
      >
        <svg viewBox="0 0 400 400" aria-label="Ruleta europea de 37 casillas">
          {WHEEL.map((n, i) => {
            const a = (((i * 360) / 37 - 90 - 180 / 37) * Math.PI) / 180,
              b = a + (2 * Math.PI) / 37,
              mid = (a + b) / 2;
            const x = (r: number, t: number) => 200 + r * Math.cos(t),
              y = (r: number, t: number) => 200 + r * Math.sin(t);
            return (
              <g key={n}>
                <path
                  d={`M ${x(127, a)} ${y(127, a)} L ${x(190, a)} ${y(190, a)} A 190 190 0 0 1 ${x(190, b)} ${y(190, b)} L ${x(127, b)} ${y(127, b)} Z`}
                  fill={
                    n === 0
                      ? "#21866d"
                      : color(n) === "red"
                        ? "#a43c4b"
                        : "#20212a"
                  }
                  stroke="#b89b60"
                  strokeWidth=".6"
                />
                <text
                  x={x(164, mid)}
                  y={y(164, mid)}
                  fill="#fff4dc"
                  fontSize="13"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(i * 360) / 37},${x(164, mid)},${y(164, mid)})`}
                >
                  {n}
                </text>
              </g>
            );
          })}
          <circle
            cx="200"
            cy="200"
            r="126"
            fill="#191b20"
            stroke="#a98d54"
            strokeWidth="6"
          />
          <circle
            cx="200"
            cy="200"
            r="110"
            fill="none"
            stroke="#39362d"
            strokeWidth="1"
          />
        </svg>
      </div>
      <div className="wheel-hub">
        <span>EUROPEAN</span>
        <b>G</b>
        <small>SINGLE ZERO</small>
      </div>
    </div>
  );
}
export function Roulette() {
  const { state, act, ready } = useGame();
  const [bets, setBets] = useState<RouletteBet[]>([]),
    [chip, setChip] = useState(100);
  const { busy, run } = useGate();
  const round = state.active?.game === "roulette" ? state.active : null;
  const latest = state.history.find((h) => h.game === "roulette");
  const { duration } = useCasinoClock("roulette", 4.5);
  usePlayViewport(".wheel-panel", round?.id);
  const activeBets = round?.bets ?? bets,
    total = cents(activeBets.reduce((a, b) => a + b.amount, 0));
  const add = (kind: RouletteBet["kind"], value?: number) => {
    if (round || busy) return;
    setBets((old) =>
      cents(old.reduce((a, b) => a + b.amount, 0) + chip) <= state.balance
        ? [...old, { kind, value, amount: chip }]
        : old,
    );
  };
  const amountOn = (kind: RouletteBet["kind"], value?: number) =>
    activeBets
      .filter((b) => b.kind === kind && b.value === value)
      .reduce((a, b) => a + b.amount, 0);
  const cell = (
    label: string,
    kind: RouletteBet["kind"],
    value?: number,
    cls = "",
  ) => (
    <button
      key={`${kind}-${value}`}
      className={`roulette-cell ${cls}`}
      disabled={!!round || busy || total + chip > state.balance}
      onClick={() => add(kind, value)}
    >
      {label}
      {amountOn(kind, value) > 0 && <i>{amountOn(kind, value)}</i>}
    </button>
  );
  return (
    <>
      <div className="roulette-layout">
        <div className="wheel-panel">
          <span className="eyebrow">FAITES VOS JEUX</span>
          <Wheel
            result={round?.result ?? latest?.rouletteNumber ?? 0}
            spinning={!!round}
            duration={duration}
          />
          <div className="recent-numbers">
            {state.history
              .filter(
                (h) => h.game === "roulette" && h.rouletteNumber !== undefined,
              )
              .slice(0, 8)
              .map((h) => (
                <span key={h.id} className={color(h.rouletteNumber!)}>
                  {h.rouletteNumber}
                </span>
              ))}
          </div>
          <p>
            {round
              ? "Rien ne va plus. La bola está en juego."
              : "Un giro. Treinta y siete posibilidades."}
          </p>
        </div>
        <div className="roulette-board-panel">
          <div className="section-title">
            <h3>Coloca tus fichas</h3>
            <span>EUROPEA · UN SOLO 0</span>
          </div>
          <div className="chip-picker">
            {[10, 50, 100, 500].map((n) => (
              <button
                key={n}
                className={`bet-chip ${chip === n ? "chosen" : ""}`}
                disabled={!!round || busy}
                onClick={() => setChip(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="all-chip"
              disabled={!!round || busy || state.balance <= total}
              onClick={() => setChip(cents(state.balance - total))}
            >
              Todo el saldo
              <br />
              <small>como una ficha</small>
            </button>
          </div>
          <div className="number-board">
            {cell("0", "number", 0, "green zero")}
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) =>
              cell(String(n), "number", n, color(n)),
            )}
          </div>
          <div className="dozen-board">
            {[1, 2, 3].map((n) =>
              cell(`${(n - 1) * 12 + 1}–${n * 12}`, "dozen", n),
            )}
          </div>
          <div className="outside-board">
            {cell("PAR", "even")}
            {cell("◆ ROJO", "red", undefined, "red")}
            {cell("◆ NEGRO", "black")}
            {cell("IMPAR", "odd")}
          </div>
          <div className="bet-summary">
            <span>
              EN LA MESA <Coin value={total} />
            </span>
            <div>
              <button
                aria-label="Deshacer última ficha"
                title="Deshacer"
                disabled={!!round || busy || !bets.length}
                onClick={() => setBets((b) => b.slice(0, -1))}
              >
                <Undo2 size={18} />
              </button>
              <button
                aria-label="Quitar todas las fichas"
                title="Limpiar"
                disabled={!!round || busy || !bets.length}
                onClick={() => setBets([])}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="active-bets">
            {activeBets.length ? (
              Object.entries(
                activeBets.reduce<Record<string, number>>((a, b) => {
                  const l = betLabel(b);
                  a[l] = (a[l] ?? 0) + b.amount;
                  return a;
                }, {}),
              ).map(([label, n]) => (
                <span key={label}>
                  {label} <b>{n}</b>
                </span>
              ))
            ) : (
              <span>Selecciona una ficha y toca el tablero.</span>
            )}
          </div>
          <button
            className="button gold wide"
            disabled={
              !ready || busy || !!round || !total || total > state.balance
            }
            onClick={() =>
              void run(async () => {
                const next = await act({ type: "roulette", bets });
                if (next) setBets([]);
              })
            }
          >
            <RotateCw size={18} />
            {round ? "Girando…" : "Girar la ruleta"}
          </button>
          <p className="fine-print">
            Pagos netos: pleno 35:1 · docena 2:1 · color y paridad 1:1. El 0
            pierde en apuestas externas. Pleno: 1/37; docena: 12/37;
            color/paridad: 18/37.
          </p>
        </div>
      </div>
      {!round && <ResultBanner result={latest} />}
      <History game="roulette" />
    </>
  );
}
