export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export type BetKind = "number" | "red" | "black" | "even" | "odd" | "dozen";
export type RouletteBet = { kind: BetKind; value?: number; amount: number };
export const color = (n: number) =>
  n === 0 ? "green" : RED.has(n) ? "red" : "black";
export function validRouletteBet(b: RouletteBet): boolean {
  return (
    Number.isFinite(b.amount) &&
    b.amount > 0 &&
    ["number", "red", "black", "even", "odd", "dozen"].includes(b.kind) &&
    (b.kind !== "number" ||
      (Number.isInteger(b.value) && b.value! >= 0 && b.value! <= 36)) &&
    (b.kind !== "dozen" || [1, 2, 3].includes(b.value!))
  );
}
export function rouletteReturn(b: RouletteBet, result: number): number {
  if (
    !validRouletteBet(b) ||
    !Number.isInteger(result) ||
    result < 0 ||
    result > 36
  )
    throw new Error("Apuesta inválida");
  if (b.kind === "number") return result === b.value ? b.amount * 36 : 0;
  if (result === 0) return 0;
  const win =
    b.kind === "red"
      ? RED.has(result)
      : b.kind === "black"
        ? !RED.has(result)
        : b.kind === "even"
          ? result % 2 === 0
          : b.kind === "odd"
            ? result % 2 === 1
            : Math.ceil(result / 12) === b.value;
  return win ? b.amount * (b.kind === "dozen" ? 3 : 2) : 0;
}
export function betLabel(b: RouletteBet): string {
  return b.kind === "number"
    ? `Número ${b.value}`
    : b.kind === "dozen"
      ? `${b.value}ª docena`
      : { red: "Rojo", black: "Negro", even: "Par", odd: "Impar" }[b.kind];
}
