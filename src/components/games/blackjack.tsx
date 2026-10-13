"use client";
import { useEffect, useState } from "react";
import { Plus, Hand as HandIcon, Play, ShieldCheck } from "lucide-react";
import { useGame } from "../provider";
import {
  BetInput,
  Coin,
  History,
  PlayingCard,
  ResultBanner,
  useGate,
  usePlayViewport,
} from "../shared";
import { handValue, natural } from "@/lib/blackjack";
export function Blackjack() {
  const { state, act, ready } = useGame();
  const [stake, setStake] = useState(100);
  const { busy, run } = useGate();
  const round = state.active?.game === "blackjack" ? state.active : null;
  usePlayViewport(".blackjack-table", round?.id);
  const latest = state.history.find((h) => h.game === "blackjack");
  const hand = round?.hand ?? latest?.blackjackHand;
  const isNatural =
    round && (natural(round.hand.player) || natural(round.hand.dealer));
  useEffect(() => {
    if (!round || !isNatural) return;
    const timer = setTimeout(
      () => {
        void act({ type: "settle", id: round.id });
      },
      state.settings.reducedMotion ? 100 : 900,
    );
    return () => clearTimeout(timer);
  }, [round?.id, isNatural, act, state.settings.reducedMotion]);
  const perform = (type: "hit" | "stand") =>
    run(async () => {
      if (!round) return;
      await act({ type, id: round.id });
      await new Promise((resolve) =>
        setTimeout(resolve, state.settings.reducedMotion ? 0 : 350),
      );
    });
  return (
    <>
      <div className="game-layout">
        <div className="blackjack-table">
          <div className="table-top">
            <span>
              <i className="live-dot" /> MESA PRIVADA
            </span>
            <span>UNA BARAJA · 52 CARTAS</span>
          </div>
          <div className="hand-area">
            <div className="hand-label">
              CRUPIER{" "}
              <b>{hand ? (round ? "?" : handValue(hand.dealer)) : "—"}</b>
            </div>
            <div className="cards-row">
              {hand ? (
                hand.dealer.map((c, i) => (
                  <PlayingCard
                    key={`${c.suit}${c.rank}`}
                    card={c}
                    index={i}
                    hidden={!!round && i === 1}
                  />
                ))
              ) : (
                <>
                  <PlayingCard hidden />
                  <PlayingCard hidden />
                </>
              )}
            </div>
          </div>
          <div className="table-lettering">
            <strong>BLACKJACK</strong>
            <span>PAGA 3 A 2</span>
            <small>EL CRUPIER SE PLANTA EN TODO 17</small>
          </div>
          <div className="hand-area player-hand">
            <div className="cards-row">
              {hand ? (
                hand.player.map((c, i) => (
                  <PlayingCard key={`${c.suit}${c.rank}`} card={c} index={i} />
                ))
              ) : (
                <div className="card-placeholder">TU MANO</div>
              )}
            </div>
            <div className="hand-label">
              {state.name.toUpperCase()}{" "}
              <b>{hand ? handValue(hand.player) : "—"}</b>
            </div>
          </div>
          <div className="table-stake">
            {round ? (
              <>
                <Coin value={round.stake} /> EN JUEGO
              </>
            ) : (
              "QUE EMPIECE LA NOCHE"
            )}
          </div>
          {round && (
            <div className="mobile-table-actions">
              <div className="action-pair">
                <button
                  className="button gold"
                  disabled={busy || !!isNatural}
                  onClick={() => void perform("hit")}
                >
                  <Plus size={18} /> Pedir
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !!isNatural}
                  onClick={() => void perform("stand")}
                >
                  <HandIcon size={18} /> Plantarse
                </button>
              </div>
            </div>
          )}
        </div>
        <aside className={`game-controls ${round ? "playing-controls" : ""}`}>
          <span className="eyebrow">EL CLÁSICO DEL CLUB</span>
          <h2>Ve por el 21.</h2>
          <p>Acércate a 21 sin pasarte y supera al crupier.</p>
          <BetInput
            value={stake}
            onChange={setStake}
            disabled={!!round || busy}
          />
          {round ? (
            <div className="action-pair">
              <button
                className="button gold"
                disabled={busy || !!isNatural}
                onClick={() => void perform("hit")}
              >
                <Plus size={18} /> Pedir
              </button>
              <button
                className="button secondary"
                disabled={busy || !!isNatural}
                onClick={() => void perform("stand")}
              >
                <HandIcon size={18} /> Plantarse
              </button>
            </div>
          ) : (
            <button
              className="button gold wide"
              disabled={
                !ready || busy || !stake || stake > state.balance || stake <= 0
              }
              onClick={() => void run(() => act({ type: "blackjack", stake }))}
            >
              <Play size={17} /> Repartir cartas
            </button>
          )}
          <div className="rules">
            <ShieldCheck size={20} />
            <div>
              <b>Las reglas, sobre la mesa</b>
              <p>
                Victoria 1:1 · natural 3:2 · empate devuelve tu apuesta. El as
                vale 1 u 11. Sin seguros ni divisiones. Pagos redondeados a 0,01
                moneda.
              </p>
            </div>
          </div>
        </aside>
      </div>
      {!round && <ResultBanner result={latest} />}
      <History game="blackjack" />
    </>
  );
}
