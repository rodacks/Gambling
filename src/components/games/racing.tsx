"use client";
import { useRef, useState } from "react";
import { Flag, Gauge, Play } from "lucide-react";
import { useGame } from "../provider";
import {
  BetInput,
  History,
  ResultBanner,
  useGate,
  usePlayViewport,
} from "../shared";
import { Car } from "../art";
import { RUNNERS, raceProgress } from "@/lib/racing";
import { Round } from "@/lib/engine";
import { useCasinoClock } from "./use-clock";
export function Racing() {
  const { state, act, ready } = useGame();
  const [selected, setSelected] = useState(0),
    [stake, setStake] = useState(100);
  const { busy, run } = useGate();
  const round = state.active?.game === "racing" ? state.active : null;
  usePlayViewport(".race-stage", round?.id);
  const last = useRef<Extract<Round, { game: "racing" }> | null>(null);
  if (round) last.current = round;
  const { progress } = useCasinoClock("racing", 8);
  const display = round ?? last.current;
  const latest = state.history.find((h) => h.game === "racing");
  return (
    <>
      <div className="race-stage">
        <div className="race-stage-header">
          <div>
            <span className="eyebrow">AFTER HOURS GRAND PRIX</span>
            <h2>
              Midnight Run<span> / 01</span>
            </h2>
          </div>
          <div className="race-status">
            <i className={round ? "live-dot" : ""} />
            {round
              ? progress > 0.8
                ? "ÚLTIMA RECTA"
                : "EN CARRERA"
              : display
                ? "BANDERA A CUADROS"
                : "EN LA PARRILLA"}
          </div>
        </div>
        <div className="racetrack">
          <div className="finish-line" />
          {RUNNERS.map((r, i) => {
            const position = display
              ? round
                ? raceProgress(i, display.order, progress)
                : 100 - display.order.indexOf(i) * 3
              : 0;
            return (
              <div
                className={`race-lane ${i === (round?.selected ?? selected) ? "selected-lane" : ""}`}
                key={r.code}
              >
                <span className="lane-number">0{i + 1}</span>
                <div
                  className="race-car"
                  style={{
                    left: `calc(24px + (100% - 62px - var(--car-width)) * ${position / 100})`,
                    color: r.color,
                  }}
                >
                  <span>{r.code}</span>
                  <Car color={r.color} />
                </div>
                {!round && display && (
                  <b className="finish-rank">{display.order.indexOf(i) + 1}º</b>
                )}
              </div>
            );
          })}
        </div>
        <div className="track-footer">
          <span>
            <Flag size={14} /> CIRCUITO NOCTURNO
          </span>
          <span>6 PILOTOS · UNA SOLA META</span>
        </div>
      </div>
      <div className="race-bottom">
        <div>
          <div className="section-title">
            <h3>Elige a tu piloto</h3>
            <span>CUOTAS CON APUESTA INCLUIDA</span>
          </div>
          <div className="runner-grid">
            {RUNNERS.map((r, i) => (
              <button
                disabled={!!round || busy}
                className={`runner-option ${selected === i ? "chosen" : ""}`}
                key={r.code}
                onClick={() => setSelected(i)}
              >
                <div>
                  <span className="runner-code" style={{ color: r.color }}>
                    {r.code}
                  </span>
                  <strong>{r.odds.toFixed(1)}×</strong>
                </div>
                <b>{r.name}</b>
                <small>{r.weight}% de victoria</small>
                <span className="runner-stat">
                  <Gauge size={12} /> Vel. {r.speed} · Res. {r.stamina}
                </span>
              </button>
            ))}
          </div>
          <p className="fine-print">
            Las probabilidades determinan al ganador. Velocidad y resistencia
            describen a cada piloto; no modifican el porcentaje publicado.
          </p>
        </div>
        <aside className="game-controls race-bet">
          <BetInput
            value={stake}
            onChange={setStake}
            disabled={!!round || busy}
          />
          <button
            className="button gold wide"
            disabled={
              !ready ||
              busy ||
              !!round ||
              !stake ||
              stake <= 0 ||
              stake > state.balance
            }
            onClick={() =>
              void run(() => act({ type: "racing", stake, selected }))
            }
          >
            <Play size={17} />
            {round ? "Carrera en curso…" : "Acelerar"}
          </button>
          <p className="fine-print">
            Retorno potencial:{" "}
            {(stake * RUNNERS[selected].odds || 0).toLocaleString("es-UY", {
              maximumFractionDigits: 2,
            })}{" "}
            monedas.
          </p>
        </aside>
      </div>
      {!round && <ResultBanner result={latest} />}
      <History game="racing" />
    </>
  );
}
