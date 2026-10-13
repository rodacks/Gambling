import { describe, expect, it } from "vitest";
import {
  bonusRemaining,
  freshSave,
  parseSave,
  Save,
  transition,
} from "../src/lib/engine";
import { DAY, skillReward } from "../src/lib/config";
import { Card, createDeck } from "../src/lib/blackjack";
function fixedBlackjack(player: number[], dealer: number[], stake = 100): Save {
  const s = freshSave();
  s.balance -= stake;
  const cards = (ranks: number[], suit: Card["suit"]): Card[] =>
    ranks.map((rank) => ({ rank, suit }));
  const p = cards(player, "♠"),
    d = cards(dealer, "♥");
  s.active = {
    id: "hand",
    game: "blackjack",
    stake,
    startedAt: 0,
    hand: {
      player: p,
      dealer: d,
      deck: createDeck().filter(
        (c) =>
          ![...p, ...d].some((x) => x.rank === c.rank && x.suit === c.suit),
      ),
    },
  };
  return s;
}
describe("Single economic engine", () => {
  it("starts with 5,000 and rejects negative, non-finite and oversized bets", () => {
    const s = freshSave();
    expect(s.balance).toBe(5000);
    for (const stake of [0, -1, 5001, NaN, Infinity, 0.001])
      expect(() => transition(s, { type: "blackjack", stake })).toThrow();
    expect(s.balance).toBe(5000);
  });
  it("allows all-in, reserves once, and rejects concurrent rounds", () => {
    const s = transition(
      freshSave(),
      { type: "racing", stake: 5000, selected: 0 },
      0,
      "r",
    );
    expect(s.balance).toBe(0);
    expect(() => transition(s, { type: "blackjack", stake: 1 })).toThrow();
    expect(s.ledger).toHaveLength(1);
  });
  it("settlement is idempotent and conserves the ledger", () => {
    let s = transition(
      freshSave(),
      { type: "racing", stake: 100, selected: 0 },
      0,
      "r",
    );
    if (s.active?.game === "racing") s.active.order = [0, 1, 2, 3, 4, 5];
    s = transition(s, { type: "settle", id: "r" }, 8000);
    expect(s.balance).toBe(5220);
    expect(s.earned).toBe(220);
    expect(s.stats.racing.played).toBe(1);
    const again = transition(s, { type: "settle", id: "r" }, 8001);
    expect(again).toEqual(s);
    expect(s.balance).toBe(5000 + s.ledger.reduce((a, m) => a + m.amount, 0));
  });
  it("loss is counted exactly once", () => {
    let s = transition(
      freshSave(),
      { type: "racing", stake: 125, selected: 0 },
      0,
      "r",
    );
    if (s.active?.game === "racing") s.active.order = [1, 0, 2, 3, 4, 5];
    s = transition(s, { type: "settle", id: "r" }, 8000);
    expect(s.balance).toBe(4875);
    expect(s.lost).toBe(125);
    expect(s.stats.racing.losses).toBe(1);
  });
  it("natural and push correctly return stakes", () => {
    const won = transition(
      fixedBlackjack([1, 10], [10, 9]),
      { type: "settle", id: "hand" },
      1000,
    );
    expect(won.balance).toBe(5150);
    expect(won.earned).toBe(150);
    expect(won.history[0].blackjackHand?.player).toHaveLength(2);
    const tied = transition(
      fixedBlackjack([1, 10], [1, 13]),
      { type: "settle", id: "hand" },
      1000,
    );
    expect(tied.balance).toBe(5000);
    expect(tied.lost).toBe(0);
    expect(tied.stats.blackjack.ties).toBe(1);
  });
  it("cannot settle an unfinished blackjack for free", () => {
    expect(() =>
      transition(fixedBlackjack([10, 7], [10, 6]), {
        type: "settle",
        id: "hand",
      }),
    ).toThrow();
  });
  it("a bust is automatically settled", () => {
    const s = fixedBlackjack([10, 9], [10, 6]);
    if (s.active?.game === "blackjack")
      s.active.hand.deck = [{ rank: 10, suit: "♦" }];
    const end = transition(s, { type: "hit", id: "hand" });
    expect(end.active).toBe(null);
    expect(end.balance).toBe(4900);
  });
  it("combines roulette bets and applies net stats", () => {
    let s = transition(
      freshSave(),
      {
        type: "roulette",
        bets: [
          { kind: "red", amount: 100 },
          { kind: "number", value: 1, amount: 10 },
        ],
      },
      0,
      "wheel",
    );
    expect(s.balance).toBe(4890);
    if (s.active?.game === "roulette") s.active.result = 1;
    s = transition(s, { type: "settle", id: "wheel" }, 5000);
    expect(s.balance).toBe(5450);
    expect(s.earned).toBe(450);
  });
  it("rejects invalid roulette and runner selections", () => {
    expect(() =>
      transition(freshSave(), { type: "roulette", bets: [] }),
    ).toThrow();
    expect(() =>
      transition(freshSave(), {
        type: "roulette",
        bets: [{ kind: "dozen", value: 4, amount: 10 }],
      }),
    ).toThrow();
    expect(() =>
      transition(freshSave(), { type: "racing", stake: 1, selected: 6 }),
    ).toThrow();
  });
});
describe("24-hour bonus", () => {
  it("is available initially, once only, then at precisely 24h", () => {
    let s = transition(freshSave(), { type: "daily" }, 1000, "b");
    expect(s.balance).toBe(10000);
    expect(s.earned).toBe(0);
    expect(s.granted).toBe(10000);
    expect(bonusRemaining(s, 1000)).toBe(DAY);
    expect(() => transition(s, { type: "daily" }, 1000)).toThrow();
    expect(() => transition(s, { type: "daily" }, 1000 + DAY - 1)).toThrow();
    s = transition(s, { type: "daily" }, 1000 + DAY, "b2");
    expect(s.balance).toBe(15000);
  });
  it("survives reload and a backwards clock does not grant another bonus", () => {
    const s = parseSave(
      JSON.stringify(transition(freshSave(), { type: "daily" }, 100000, "b")),
    );
    expect(() => transition(s, { type: "daily" }, 90000)).toThrow();
    expect(s.lastBonus).toBe(100000);
  });
});
describe("Skills and progression", () => {
  it("allows free play with zero balance and refuses early rewards", () => {
    const initial = freshSave();
    initial.balance = 0;
    const s = transition(
      initial,
      { type: "skill", game: "jitter" },
      0,
      "skill",
    );
    expect(s.balance).toBe(0);
    expect(() =>
      transition(s, { type: "skill-end", id: "skill", score: 65 }, 9999),
    ).toThrow();
    const end = transition(
      s,
      { type: "skill-end", id: "skill", score: 65 },
      10000,
    );
    expect(end.balance).toBe(490);
    expect(end.stats.jitter.best).toBe(65);
    expect(end.stats.jitter.medals).toEqual([0, 1, 2, 3]);
    expect(
      transition(end, { type: "skill-end", id: "skill", score: 65 }, 11000),
    ).toEqual(end);
  });
  it("first medals are granted once and only highest repeat tier pays", () => {
    expect(skillReward("jitter", 65, []).reward).toBe(490);
    expect(skillReward("jitter", 65, [0, 1, 2, 3]).reward).toBe(90);
    expect(skillReward("jitter", 50, [0]).reward).toBe(265);
    expect(skillReward("precision", 7, []).reward).toBe(0);
    expect(skillReward("reaction", 180, []).tier).toBe(3);
  });
  it("false starts get no reward, lower reaction time is the record", () => {
    let s = transition(
      freshSave(),
      { type: "skill", game: "reaction" },
      0,
      "r",
    );
    s = transition(
      s,
      { type: "skill-end", id: "r", score: 100, falseStart: true },
      100,
    );
    expect(s.balance).toBe(5000);
    expect(s.stats.reaction.best).toBe(0);
    for (const [i, score] of [250, 300, 180].entries()) {
      s = transition(
        s,
        { type: "skill", game: "reaction" },
        10000 + i * 10000,
        "r" + i,
      );
      s = transition(
        s,
        { type: "skill-end", id: "r" + i, score },
        16000 + i * 10000,
      );
    }
    expect(s.stats.reaction.best).toBe(180);
    expect(s.stats.reaction.played).toBe(4);
  });
  it("abandoning loses only the reserved stake and adds one result", () => {
    let s = transition(freshSave(), { type: "blackjack", stake: 100 }, 0, "h");
    s = transition(s, { type: "abandon", id: "h" }, 100);
    expect(s.balance).toBe(4900);
    expect(s.history).toHaveLength(1);
    expect(s.active).toBe(null);
  });
});
describe("Storage boundary", () => {
  it("round trips active rounds", () => {
    const s = transition(
      freshSave(),
      { type: "blackjack", stake: 100 },
      1000,
      "h",
    );
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it("rejects malformed or unknown saves", () => {
    for (const raw of [
      "null",
      "{}",
      "bad",
      JSON.stringify({ ...freshSave(), version: 2 }),
      JSON.stringify({ ...freshSave(), balance: -1 }),
      JSON.stringify({ ...freshSave(), stats: {} }),
    ])
      expect(() => parseSave(raw)).toThrow();
  });
});
