"use client";
import { useEffect, useRef, useState } from "react";
import { Coins, Trophy, ArrowUpRight, Volume2 } from "lucide-react";
import { useGame } from "./provider";
import { fmt, GAME_NAMES, Game } from "@/lib/config";
import { Result } from "@/lib/engine";
import { Card } from "@/lib/blackjack";
export function Coin({
  value,
  sign = false,
}: {
  value: number;
  sign?: boolean;
}) {
  return (
    <span className="coin">
      <Coins size={16} />
      {sign && value > 0 ? "+" : ""}
      {fmt(value)}
    </span>
  );
}
export function useGate() {
  const gate = useRef(false),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return { busy, run };
}
/** On narrow screens, starting below the board brings the playfield into view. */
export function usePlayViewport(selector: string, activeId?: string) {
  useEffect(() => {
    if (!activeId || !window.matchMedia("(max-width: 1000px)").matches) return;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(selector)
        ?.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [activeId, selector]);
}
export function BetInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const { state } = useGame();
  return (
    <div className="bet-control">
      <label htmlFor="stake">TU APUESTA</label>
      <div className="stake-input">
        <Coins size={19} />
        <input
          id="stake"
          type="number"
          min="0.01"
          step="0.01"
          max={state.balance}
          value={Number.isNaN(value) ? "" : value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        <button
          disabled={disabled || state.balance <= 0}
          onClick={() => onChange(state.balance)}
        >
          MAX
        </button>
      </div>
      <div className="quick-bets">
        {[100, 250, 500].map((n) => (
          <button
            key={n}
            disabled={disabled || n > state.balance}
            onClick={() => onChange(n)}
          >
            {fmt(n)}
          </button>
        ))}
        <button
          disabled={disabled || state.balance <= 0}
          onClick={() => onChange(Math.round(state.balance * 50) / 100)}
        >
          ½ saldo
        </button>
      </div>
    </div>
  );
}
export function PlayingCard({
  card,
  hidden,
  index = 0,
}: {
  card?: Card;
  hidden?: boolean;
  index?: number;
}) {
  const label = card
    ? ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[card.rank] ?? card.rank)
    : "A";
  return (
    <div
      className={`playing-card ${hidden ? "card-back" : ""} ${card && ["♥", "♦"].includes(card.suit) ? "red-card" : ""}`}
      style={{ animationDelay: `${index * 90}ms` }}
      aria-label={hidden ? "Carta oculta" : `${label} ${card?.suit ?? "♠"}`}
    >
      <span>
        {hidden ? "G" : label}
        <small>{!hidden && (card?.suit ?? "♠")}</small>
      </span>
      {!hidden && (
        <>
          <b>{card?.suit ?? "♠"}</b>
          <span className="card-bottom">
            {label}
            <small>{card?.suit ?? "♠"}</small>
          </span>
        </>
      )}
    </div>
  );
}
export function ResultBanner({ result }: { result?: Result }) {
  const { state } = useGame();
  useEffect(() => {
    if (result && state.settings.sound) playTone(result.net > 0 ? 660 : 220);
  }, [result?.id]); // Sound only on a new result.
  if (!result) return null;
  return (
    <div
      role="status"
      className={`result-banner ${result.net > 0 ? "won" : result.net < 0 ? "lost" : ""}`}
    >
      <Trophy size={22} />
      <div>
        <strong>{result.label}</strong>
        <small>
          {result.detail ||
            (result.stake > 0
              ? `Retorno: ${fmt(result.returned)} · apuesta incluida`
              : result.score
                ? `Resultado: ${fmt(result.score)}`
                : "Vuelve a intentarlo")}
        </small>
      </div>
      <Coin value={result.net} sign />
    </div>
  );
}
let audioContext: AudioContext | undefined;
export function playTone(frequency = 500) {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.15,
    );
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
  } catch {
    /* Audio can be unavailable; gameplay remains usable. */
  }
}
export function History({ game, limit = 6 }: { game?: Game; limit?: number }) {
  const { state } = useGame();
  const rows = state.history
    .filter((h) => !game || h.game === game)
    .slice(0, limit);
  return (
    <div className="history">
      <div className="section-title">
        <h3>{game ? "Últimas partidas" : "Tu última jugada"}</h3>
        <span>HISTORIAL LOCAL</span>
      </div>
      {!rows.length ? (
        <div className="empty-history">
          <ArrowUpRight size={22} />
          <p>Tu historia empieza con la primera partida.</p>
        </div>
      ) : (
        <div className="history-scroll">
          <table>
            <thead>
              <tr>
                <th>JUEGO</th>
                <th>RESULTADO</th>
                <th>HORA</th>
                <th>NETO</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{GAME_NAMES[r.game]}</td>
                  <td>{r.label}</td>
                  <td>
                    {new Date(r.at).toLocaleTimeString("es-UY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td
                    className={
                      r.net > 0 ? "positive" : r.net < 0 ? "negative" : ""
                    }
                  >
                    <Coin value={r.net} sign />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export function SoundPreview() {
  return (
    <button className="button secondary" onClick={() => playTone()}>
      <Volume2 size={16} /> Probar sonido
    </button>
  );
}
