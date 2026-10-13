import { Action, Save, transition } from "../engine";
import { natural } from "../blackjack";
import { randomInt } from "../random";
import { validateSkill } from "./skill-proof";
/** No complete deck or hole card ever crosses the authenticated API boundary. */
export function clientState(source: Save): Save {
  const s = structuredClone(source);
  if (s.active?.game === "blackjack") {
    s.active.canSettle =
      natural(s.active.hand.player) || natural(s.active.hand.dealer);
    s.active.hand = {
      deck: [],
      player: s.active.hand.player,
      dealer: [s.active.hand.dealer[0], { rank: 0, suit: "♠" }],
    };
  }
  for (const h of s.history) if (h.blackjackHand) h.blackjackHand.deck = [];
  return s;
}
export function serverTransition(previous: Save, action: Action, now: number) {
  let status: "verified" | "flagged" = "verified";
  let evidence: Record<string, unknown> = {};
  let actual = action;
  if (action.type === "profile") throw new Error("Usa el editor de perfil.");
  if (action.type === "skill-end" && previous.active?.id === action.id) {
    const valid = validateSkill(
      previous.active,
      action.proof,
      now,
      action.falseStart,
    );
    evidence = { ...valid, proof: action.proof };
    if (valid.suspicious) {
      status = "flagged";
      actual = { type: "abandon", id: action.id };
    } else actual = { ...action, score: valid.score };
  }
  let state = transition(previous, actual, now);
  if (action.type === "skill" && state.active?.game === "precision")
    state.active.targets = [
      { x: 50, y: 50 },
      ...Array.from({ length: 250 }, () => ({
        x: 12 + randomInt(77),
        y: 14 + randomInt(73),
      })),
    ];
  if (status === "flagged" && state.history[0]?.id === previous.active?.id)
    state.history[0].label = "Resultado en revisión · sin recompensa";
  const result =
    state.history[0]?.id !== previous.history[0]?.id ? state.history[0] : null;
  return { state, result, status, evidence };
}
