import { shuffled } from "./random";
export type Card = { rank: number; suit: "♠" | "♥" | "♦" | "♣" };
export type Hand = { deck: Card[]; player: Card[]; dealer: Card[] };
export type Outcome = "blackjack" | "win" | "lose" | "push";
export function createDeck(): Card[] {
  return (["♠", "♥", "♦", "♣"] as const).flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })),
  );
}
export function handValue(cards: Card[]): number {
  let sum = cards.reduce(
    (a, c) => a + (c.rank === 1 ? 11 : Math.min(c.rank, 10)),
    0,
  );
  let aces = cards.filter((c) => c.rank === 1).length;
  while (sum > 21 && aces-- > 0) sum -= 10;
  return sum;
}
export const natural = (cards: Card[]) =>
  cards.length === 2 && handValue(cards) === 21;
export function deal(deck = shuffled(createDeck())): Hand {
  const d = [...deck];
  const player = [d.pop()!];
  const dealer = [d.pop()!];
  player.push(d.pop()!);
  dealer.push(d.pop()!);
  return { deck: d, player, dealer };
}
export function dealerPlay(hand: Hand): Hand {
  const next = structuredClone(hand);
  while (handValue(next.dealer) < 17 && next.deck.length)
    next.dealer.push(next.deck.pop()!);
  return next;
}
export function outcome(hand: Hand): Outcome {
  const p = handValue(hand.player),
    d = handValue(hand.dealer);
  if (p > 21) return "lose";
  if (natural(hand.player)) return natural(hand.dealer) ? "push" : "blackjack";
  if (natural(hand.dealer)) return "lose";
  if (d > 21 || p > d) return "win";
  return p === d ? "push" : "lose";
}
/** Returns include the original stake. Fractions round to the nearest cent. */
export function blackjackReturn(stake: number, result: Outcome): number {
  return (
    Math.round(
      stake * { blackjack: 2.5, win: 2, push: 1, lose: 0 }[result] * 100,
    ) / 100
  );
}
