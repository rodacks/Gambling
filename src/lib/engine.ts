import {
  DAILY_BONUS,
  DAY,
  Game,
  INITIAL_BALANCE,
  Skill,
  SKILLS,
  skillReward,
} from "./config";
import {
  blackjackReturn,
  deal,
  dealerPlay,
  Hand,
  handValue,
  natural,
  outcome,
} from "./blackjack";
import { raceOrder, RUNNERS } from "./racing";
import { RouletteBet, rouletteReturn, validRouletteBet } from "./roulette";
import { randomInt } from "./random";

export type GameStats = {
  played: number;
  wins: number;
  losses: number;
  ties: number;
  earned: number;
  lost: number;
  best: number;
  bestNet?: number;
  medals: number[];
};
type BaseRound = { id: string; stake: number; startedAt: number };
export type Round = BaseRound &
  (
    | { game: "blackjack"; hand: Hand; canSettle?: boolean }
    | { game: "racing"; selected: number; order: number[] }
    | { game: "roulette"; bets: RouletteBet[]; result: number }
    | {
        game: Skill;
        medals: number[];
        delay: number;
        prepared?: boolean;
        targets?: { x: number; y: number }[];
      }
  );
export type Result = {
  id: string;
  game: Game;
  at: number;
  stake: number;
  returned: number;
  net: number;
  label: string;
  score?: number;
  detail?: string;
  rouletteNumber?: number;
  blackjackHand?: Hand;
};
export type Movement = {
  id: string;
  at: number;
  label: string;
  amount: number;
};
export type Save = {
  version: 1;
  name: string;
  balance: number;
  peak: number;
  granted: number;
  earned: number;
  lost: number;
  xp: number;
  lastBonus: number | null;
  settings: { sound: boolean; reducedMotion: boolean; sensitivity?: number };
  stats: Record<Game, GameStats>;
  history: Result[];
  ledger: Movement[];
  active: Round | null;
};
const games: Game[] = [
  "blackjack",
  "racing",
  "roulette",
  "jitter",
  "reaction",
  "precision",
];
export const cents = (value: number) => Math.round(value * 100) / 100;
export function freshSave(): Save {
  const stats = {} as Save["stats"];
  for (const game of games)
    stats[game] = {
      played: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      earned: 0,
      lost: 0,
      best: 0,
      medals: [],
    };
  return {
    version: 1,
    name: "Night Player",
    balance: INITIAL_BALANCE,
    peak: INITIAL_BALANCE,
    granted: INITIAL_BALANCE,
    earned: 0,
    lost: 0,
    xp: 0,
    lastBonus: null,
    settings: { sound: true, reducedMotion: false },
    stats,
    history: [],
    ledger: [],
    active: null,
  };
}
export type Action =
  | { type: "daily" }
  | { type: "profile"; name: string }
  | { type: "settings"; settings: Partial<Save["settings"]> }
  | { type: "blackjack"; stake: number }
  | { type: "hit" | "stand"; id: string }
  | { type: "racing"; stake: number; selected: number }
  | { type: "roulette"; bets: RouletteBet[] }
  | { type: "settle"; id: string }
  | { type: "skill"; game: Skill }
  | { type: "skill-first"; id: string }
  | {
      type: "skill-end";
      id: string;
      score: number;
      falseStart?: boolean;
      proof?: import("./v2/skill-proof").SkillProof;
    }
  | { type: "abandon"; id: string };
export const bonusRemaining = (s: Save, now: number) =>
  s.lastBonus === null ? 0 : Math.max(0, s.lastBonus + DAY - now);
function movement(
  s: Save,
  amount: number,
  label: string,
  at: number,
  id: string,
) {
  s.balance = cents(s.balance + amount);
  s.peak = Math.max(s.peak, s.balance);
  s.ledger = [{ id, at, label, amount }, ...s.ledger].slice(0, 100);
}
function reserve(s: Save, stake: number, now: number, id: string) {
  if (s.active)
    throw new Error("Termina la partida en curso antes de iniciar otra.");
  if (
    !Number.isFinite(stake) ||
    stake <= 0 ||
    stake > s.balance ||
    stake !== cents(stake)
  )
    throw new Error("La apuesta debe ser positiva y no superar tu saldo.");
  movement(s, -stake, "Apuesta reservada", now, id + "-stake");
}
function finish(
  s: Save,
  returned: number,
  label: string,
  now: number,
  score?: number,
  detail?: string,
) {
  const round = s.active!;
  returned = cents(returned);
  const net = cents(returned - round.stake),
    stat = s.stats[round.game];
  movement(s, returned, label, now, round.id + "-return");
  const earned = Math.max(0, net),
    lost = Math.max(0, -net);
  s.earned = cents(s.earned + earned);
  s.lost = cents(s.lost + lost);
  stat.earned = cents(stat.earned + earned);
  stat.lost = cents(stat.lost + lost);
  stat.played++;
  stat.bestNet = Math.max(stat.bestNet ?? 0, net);
  if (net > 0) stat.wins++;
  else if (net < 0 || (round.stake === 0 && returned === 0)) stat.losses++;
  else stat.ties++;
  s.xp += net > 0 ? 35 : 15;
  if (score !== undefined && score > 0)
    stat.best =
      round.game === "reaction"
        ? stat.best
          ? Math.min(stat.best, score)
          : score
        : Math.max(stat.best, score);
  s.history = [
    {
      id: round.id,
      game: round.game,
      at: now,
      stake: round.stake,
      returned,
      net,
      label,
      score,
      detail,
      rouletteNumber: round.game === "roulette" ? round.result : undefined,
      blackjackHand:
        round.game === "blackjack" ? structuredClone(round.hand) : undefined,
    },
    ...s.history,
  ].slice(0, 60);
  s.active = null;
}
function finishBlackjack(s: Save, now: number) {
  if (s.active?.game !== "blackjack") return;
  const result = outcome(s.active.hand);
  finish(
    s,
    blackjackReturn(s.active.stake, result),
    {
      blackjack: "¡Blackjack natural!",
      win: "Victoria",
      lose: "Gana el crupier",
      push: "Empate",
    }[result],
    now,
    undefined,
    `Tú: ${handValue(s.active.hand.player)} · Crupier: ${handValue(s.active.hand.dealer)}`,
  );
}
/** Pure state transition: time and id are injected, making economic rules testable. */
export function transition(
  previous: Save,
  action: Action,
  now = Date.now(),
  id = crypto.randomUUID(),
): Save {
  const s = structuredClone(previous);
  if (action.type === "daily") {
    if (bonusRemaining(s, now) > 0)
      throw new Error("Tu próxima bonificación todavía no está disponible.");
    s.lastBonus = now;
    s.granted += DAILY_BONUS;
    movement(s, DAILY_BONUS, "Bonificación diaria", now, id);
  } else if (action.type === "profile") {
    const name = action.name.trim().slice(0, 24);
    if (!name) throw new Error("Escribe un nombre.");
    s.name = name;
  } else if (action.type === "settings") {
    if (
      action.settings.sensitivity !== undefined &&
      (!Number.isFinite(action.settings.sensitivity) ||
        action.settings.sensitivity < 0.25 ||
        action.settings.sensitivity > 3)
    )
      throw new Error("La sensibilidad debe estar entre 0,25 y 3.");
    s.settings = { ...s.settings, ...action.settings };
  } else if (action.type === "blackjack") {
    reserve(s, action.stake, now, id);
    s.active = {
      id,
      game: "blackjack",
      stake: action.stake,
      startedAt: now,
      hand: deal(),
    };
    // Naturals are revealed and settled by the UI's single settle command.
  } else if (action.type === "racing") {
    if (!Number.isInteger(action.selected) || !RUNNERS[action.selected])
      throw new Error("Selecciona un corredor.");
    reserve(s, action.stake, now, id);
    s.active = {
      id,
      game: "racing",
      stake: action.stake,
      startedAt: now,
      selected: action.selected,
      order: raceOrder(),
    };
  } else if (action.type === "roulette") {
    if (
      !action.bets.length ||
      action.bets.some(
        (b) => !validRouletteBet(b) || b.amount !== cents(b.amount),
      )
    )
      throw new Error("Añade una apuesta válida.");
    const stake = cents(action.bets.reduce((a, b) => a + b.amount, 0));
    reserve(s, stake, now, id);
    s.active = {
      id,
      game: "roulette",
      stake,
      startedAt: now,
      bets: structuredClone(action.bets),
      result: randomInt(37),
    };
  } else if (action.type === "skill") {
    if (s.active) throw new Error("Termina primero la partida en curso.");
    s.active = {
      id,
      game: action.game,
      stake: 0,
      startedAt: now,
      medals: [...s.stats[action.game].medals],
      delay: action.game === "reaction" ? 1800 + randomInt(3001) : 0,
      prepared: action.game !== "reaction",
    };
  } else {
    // Repeated completion callbacks and commands from stale tabs are harmless.
    if (!s.active || action.id !== s.active.id) return previous;
    const r = s.active;
    if (action.type === "skill-first") {
      if (!("prepared" in r) || r.game === "reaction")
        throw new Error("Esta partida no necesita preparación.");
      if (r.prepared) {
        r.startedAt = now;
        r.prepared = false;
      }
    } else if (action.type === "hit" || action.type === "stand") {
      if (r.game !== "blackjack") throw new Error("Partida incompatible.");
      if (natural(r.hand.player) || natural(r.hand.dealer)) {
        finishBlackjack(s, now);
        return s;
      }
      if (action.type === "hit") {
        if (!r.hand.deck.length) throw new Error("La baraja está vacía.");
        r.hand.player.push(r.hand.deck.pop()!);
        if (handValue(r.hand.player) > 21) finishBlackjack(s, now);
        else if (handValue(r.hand.player) === 21) {
          r.hand = dealerPlay(r.hand);
          finishBlackjack(s, now);
        }
      } else {
        r.hand = dealerPlay(r.hand);
        finishBlackjack(s, now);
      }
    } else if (action.type === "settle") {
      if (r.game === "blackjack") {
        if (!natural(r.hand.player) && !natural(r.hand.dealer))
          throw new Error("Pide carta o plántate.");
        finishBlackjack(s, now);
      } else if (r.game === "racing") {
        finish(
          s,
          r.order[0] === r.selected ? r.stake * RUNNERS[r.selected].odds : 0,
          `Gana ${RUNNERS[r.order[0]].name}`,
          now,
          undefined,
          r.order.map((i) => RUNNERS[i].name).join(" → "),
        );
      } else if (r.game === "roulette")
        finish(
          s,
          r.bets.reduce((a, b) => a + rouletteReturn(b, r.result), 0),
          `Salió el ${r.result}`,
          now,
        );
      else throw new Error("Esta partida necesita un resultado de habilidad.");
    } else if (action.type === "skill-end") {
      if (!["jitter", "reaction", "precision"].includes(r.game))
        throw new Error("Partida incompatible.");
      const game = r.game as Skill;
      if ("prepared" in r && r.prepared)
        throw new Error("Haz clic para comenzar.");
      if (!Number.isFinite(action.score) || action.score < 0)
        throw new Error("Resultado inválido.");
      if (
        game !== "reaction" &&
        now - r.startedAt < SKILLS[game].duration * 1000
      )
        throw new Error("La partida aún no terminó.");
      const falseStart =
        action.falseStart ||
        (game === "reaction" &&
          now < r.startedAt + ("delay" in r ? r.delay : 0));
      const score = falseStart ? 0 : Math.round(action.score);
      const result = skillReward(game, score, "medals" in r ? r.medals : []);
      s.stats[game].medals = [
        ...new Set([...s.stats[game].medals, ...result.unlocked]),
      ];
      finish(
        s,
        result.reward,
        falseStart
          ? "Salida anticipada · sin premio"
          : result.tier < 0
            ? "Sigue practicando"
            : ["Bronce", "Plata", "Oro", "Diamante"][result.tier] +
              " conseguido",
        now,
        score,
      );
    } else if (action.type === "abandon") {
      finish(s, 0, "Partida abandonada", now);
    }
  }
  return s;
}

/** Validation at the storage boundary, independent of the UI/storage provider. */
export function parseSave(raw: string): Save {
  const s = JSON.parse(raw) as Save;
  const positive = (n: unknown) =>
    typeof n === "number" &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= Number.MAX_SAFE_INTEGER / 100;
  if (
    !s ||
    s.version !== 1 ||
    typeof s.name !== "string" ||
    s.name.length > 24 ||
    !["balance", "peak", "granted", "earned", "lost", "xp"].every((k) =>
      positive(s[k as keyof Save]),
    ) ||
    (s.lastBonus !== null && !positive(s.lastBonus)) ||
    !s.settings ||
    typeof s.settings.sound !== "boolean" ||
    typeof s.settings.reducedMotion !== "boolean" ||
    (s.settings.sensitivity !== undefined &&
      (!Number.isFinite(s.settings.sensitivity) ||
        s.settings.sensitivity < 0.25 ||
        s.settings.sensitivity > 3))
  )
    throw new Error("Guardado incompatible o dañado.");
  if (
    !s.stats ||
    games.some((g) => {
      const v = s.stats[g];
      return (
        !v ||
        (v.bestNet !== undefined && !positive(v.bestNet)) ||
        !["played", "wins", "losses", "ties", "earned", "lost", "best"].every(
          (k) => positive(v[k as keyof GameStats]),
        ) ||
        !Array.isArray(v.medals) ||
        v.medals.some((m) => ![0, 1, 2, 3].includes(m))
      );
    })
  )
    throw new Error("Estadísticas dañadas.");
  if (
    !Array.isArray(s.history) ||
    s.history.length > 60 ||
    s.history.some(
      (r) =>
        !games.includes(r.game) ||
        typeof r.id !== "string" ||
        typeof r.label !== "string" ||
        !positive(r.at) ||
        !positive(r.stake) ||
        !positive(r.returned) ||
        !Number.isFinite(r.net) ||
        (r.score !== undefined && !positive(r.score)) ||
        (r.detail !== undefined && typeof r.detail !== "string") ||
        (r.rouletteNumber !== undefined &&
          (!Number.isInteger(r.rouletteNumber) ||
            r.rouletteNumber < 0 ||
            r.rouletteNumber > 36)),
    )
  )
    throw new Error("Historial dañado.");
  const validHand = (h: Hand) =>
    h &&
    [h.deck, h.player, h.dealer].every(
      (a) =>
        Array.isArray(a) &&
        a.every(
          (c) =>
            c &&
            Number.isInteger(c.rank) &&
            c.rank >= 1 &&
            c.rank <= 13 &&
            ["♠", "♥", "♦", "♣"].includes(c.suit),
        ),
    ) &&
    h.player.length >= 2 &&
    h.dealer.length >= 2 &&
    h.deck.length + h.player.length + h.dealer.length === 52 &&
    new Set([...h.deck, ...h.player, ...h.dealer].map((c) => c.rank + c.suit))
      .size === 52;
  if (
    s.history.some(
      (r) => r.blackjackHand !== undefined && !validHand(r.blackjackHand),
    )
  )
    throw new Error("Historial de cartas dañado.");
  if (
    !Array.isArray(s.ledger) ||
    s.ledger.length > 100 ||
    s.ledger.some(
      (m) =>
        typeof m.id !== "string" ||
        typeof m.label !== "string" ||
        !positive(m.at) ||
        !Number.isFinite(m.amount),
    )
  )
    throw new Error("Movimientos dañados.");
  if (s.active !== null) {
    const r = s.active;
    if (
      !r ||
      !games.includes(r.game) ||
      typeof r.id !== "string" ||
      !positive(r.startedAt) ||
      !positive(r.stake)
    )
      throw new Error("Partida dañada.");
    if (r.game === "blackjack") {
      if (!validHand(r.hand)) throw new Error("Mano dañada.");
    } else if (r.game === "racing") {
      if (
        !Array.isArray(r.order) ||
        r.order.length !== 6 ||
        new Set(r.order).size !== 6 ||
        r.order.some((i) => !Number.isInteger(i) || !RUNNERS[i]) ||
        !RUNNERS[r.selected]
      )
        throw new Error("Carrera dañada.");
    } else if (r.game === "roulette") {
      if (
        !Array.isArray(r.bets) ||
        !r.bets.length ||
        r.bets.some((b) => !validRouletteBet(b)) ||
        !Number.isInteger(r.result) ||
        r.result < 0 ||
        r.result > 36
      )
        throw new Error("Ruleta dañada.");
    } else if (
      !Array.isArray(r.medals) ||
      r.medals.some((m) => ![0, 1, 2, 3].includes(m)) ||
      !positive(r.delay)
    )
      throw new Error("Desafío dañado.");
  }
  return s;
}
