import { describe, expect, it } from "vitest";
import {
  blackjackReturn,
  Card,
  createDeck,
  deal,
  dealerPlay,
  handValue,
  natural,
  outcome,
} from "../src/lib/blackjack";
import { RED, rouletteReturn, WHEEL } from "../src/lib/roulette";
import { raceOrder, raceProgress, RUNNERS } from "../src/lib/racing";
import { randomInt, shuffled } from "../src/lib/random";
const cards = (...ranks: number[]): Card[] =>
  ranks.map((rank) => ({ rank, suit: "♠" }));
const hand = (p: number[], d: number[], deck: number[] = []) => ({
  player: cards(...p),
  dealer: cards(...d),
  deck: cards(...deck),
});
describe("Blackjack: rules and returns", () => {
  it("has exactly 52 unique cards, deals without duplication", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.rank + c.suit)).size).toBe(52);
    const h = deal(deck);
    expect(h.deck).toHaveLength(48);
    expect([...h.player, ...h.dealer]).toHaveLength(4);
  });
  it.each([
    [[1, 1, 9], 21],
    [[1, 1, 9, 10], 21],
    [[1, 13], 21],
    [[10, 7, 8], 25],
    [[1, 6], 17],
    [[1, 1, 1, 1], 14],
  ])("evaluates %j as %d", (ranks, value) =>
    expect(handValue(cards(...ranks))).toBe(value),
  );
  it("requires exactly two cards for natural", () => {
    expect(natural(cards(1, 10))).toBe(true);
    expect(natural(cards(1, 5, 5))).toBe(false);
  });
  it("stands on soft 17", () => {
    expect(dealerPlay(hand([10, 9], [1, 6], [10])).dealer).toEqual(cards(1, 6));
  });
  it("hits 16 and handles aces", () => {
    expect(handValue(dealerPlay(hand([10, 9], [1, 5], [1])).dealer)).toBe(17);
  });
  it.each([
    [[1, 13], [1, 10], "push"],
    [[1, 10], [10, 10], "blackjack"],
    [[10, 5, 6], [1, 10], "lose"],
    [[10, 9], [10, 7], "win"],
    [[10, 8], [10, 8], "push"],
    [[10, 10, 3], [10, 10, 2], "lose"],
    [[10, 8], [10, 8, 10], "win"],
  ])("settles player %j and dealer %j as %s", (p, d, r) =>
    expect(outcome(hand(p as number[], d as number[]))).toBe(r),
  );
  it("pays natural 3:2, ordinary win 1:1, pushes and losses", () => {
    expect(blackjackReturn(101, "blackjack")).toBe(252.5);
    expect(blackjackReturn(100, "win")).toBe(200);
    expect(blackjackReturn(100, "push")).toBe(100);
    expect(blackjackReturn(100, "lose")).toBe(0);
  });
});
describe("European roulette", () => {
  it("has every number once and 18 reds", () => {
    expect([...WHEEL].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 37 }, (_, i) => i),
    );
    expect(RED.size).toBe(18);
  });
  it("zero loses on all outside bets", () => {
    for (const kind of ["red", "black", "even", "odd", "dozen"] as const)
      expect(rouletteReturn({ kind, amount: 100, value: 1 }, 0)).toBe(0);
    expect(rouletteReturn({ kind: "number", value: 0, amount: 100 }, 0)).toBe(
      3600,
    );
  });
  it("checks all numbers against expected payouts", () => {
    for (let n = 1; n <= 36; n++) {
      expect(rouletteReturn({ kind: "red", amount: 10 }, n)).toBe(
        RED.has(n) ? 20 : 0,
      );
      expect(rouletteReturn({ kind: "black", amount: 10 }, n)).toBe(
        RED.has(n) ? 0 : 20,
      );
      expect(rouletteReturn({ kind: "even", amount: 10 }, n)).toBe(
        n % 2 === 0 ? 20 : 0,
      );
      expect(rouletteReturn({ kind: "odd", amount: 10 }, n)).toBe(
        n % 2 === 1 ? 20 : 0,
      );
      for (let dozen = 1; dozen <= 3; dozen++)
        expect(
          rouletteReturn({ kind: "dozen", value: dozen, amount: 10 }, n),
        ).toBe(Math.ceil(n / 12) === dozen ? 30 : 0);
      expect(rouletteReturn({ kind: "number", value: n, amount: 10 }, n)).toBe(
        360,
      );
    }
  });
  it("rejects invalid numbers and stakes", () => {
    expect(() =>
      rouletteReturn({ kind: "number", value: 37, amount: 100 }, 1),
    ).toThrow();
    expect(() => rouletteReturn({ kind: "red", amount: -1 }, 1)).toThrow();
  });
});
describe("Weighted racing and animation", () => {
  it("maps every bucket to the advertised probability exactly", () => {
    const counts = Array(6).fill(0);
    for (let roll = 0; roll < 100; roll++) {
      let first = true;
      const order = raceOrder((max) => {
        if (first) {
          first = false;
          return roll;
        }
        return max - 1;
      });
      counts[order[0]]++;
      expect(new Set(order).size).toBe(6);
    }
    expect(counts).toEqual(RUNNERS.map((r) => r.weight));
  });
  it("never crosses the finish before the final frame and respects order", () => {
    const order = [4, 2, 0, 5, 1, 3];
    for (let step = 0; step < 100; step++) {
      for (let i = 0; i < 6; i++)
        expect(raceProgress(i, order, step / 100)).toBeLessThan(100);
    }
    const positions = order.map((i) => raceProgress(i, order, 1));
    expect(positions).toEqual([...positions].sort((a, b) => b - a));
  });
});
describe("Random helpers", () => {
  it("rejects invalid ranges and remains in bounds", () => {
    expect(() => randomInt(0)).toThrow();
    expect(() => randomInt(2.5)).toThrow();
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(37);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(37);
    }
  });
  it("shuffles without modifying input or dropping elements", () => {
    const input = [1, 2, 3, 4];
    expect(shuffled(input, () => 0).sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});
