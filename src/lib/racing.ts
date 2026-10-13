import { randomInt } from "./random";
export const RUNNERS = [
  {
    name: "Gold Rush",
    code: "GR",
    weight: 28,
    odds: 3.2,
    color: "#edc777",
    speed: 96,
    stamina: 88,
  },
  {
    name: "Neon Ghost",
    code: "NG",
    weight: 23,
    odds: 3.9,
    color: "#a69af7",
    speed: 93,
    stamina: 85,
  },
  {
    name: "Redline",
    code: "RL",
    weight: 19,
    odds: 4.7,
    color: "#fb777c",
    speed: 90,
    stamina: 82,
  },
  {
    name: "Mint Condition",
    code: "MC",
    weight: 14,
    odds: 6.4,
    color: "#73ddbc",
    speed: 87,
    stamina: 79,
  },
  {
    name: "Blue Comet",
    code: "BC",
    weight: 10,
    odds: 9,
    color: "#75b9fc",
    speed: 84,
    stamina: 75,
  },
  {
    name: "Wild Card",
    code: "WC",
    weight: 6,
    odds: 15,
    color: "#f4a66b",
    speed: 80,
    stamina: 72,
  },
] as const;
export function raceOrder(rng = randomInt): number[] {
  const remaining = RUNNERS.map((_, i) => i),
    order: number[] = [];
  while (remaining.length) {
    let roll = rng(remaining.reduce((s, i) => s + RUNNERS[i].weight, 0));
    let selected = 0;
    for (let i = 0; i < remaining.length; i++) {
      roll -= RUNNERS[remaining[i]].weight;
      if (roll < 0) {
        selected = i;
        break;
      }
    }
    order.push(remaining.splice(selected, 1)[0]);
  }
  return order;
}
/** Nobody crosses before the winner. Final distances agree with sampled order. */
export function raceProgress(
  runner: number,
  order: number[],
  t: number,
): number {
  const rank = order.indexOf(runner);
  const end = 100 - rank * 3;
  const clamped = Math.max(0, Math.min(1, t));
  const wave =
    Math.sin(clamped * Math.PI * 5 + runner * 1.7) *
    Math.sin(clamped * Math.PI) *
    4;
  return Math.max(0, Math.min(99.8, end * clamped + wave));
}
