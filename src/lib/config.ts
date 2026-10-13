export const INITIAL_BALANCE = 5000;
export const DAILY_BONUS = 5000;
export const DAY = 86_400_000;
export const GAME_NAMES = {
  blackjack: "Blackjack",
  racing: "Midnight Run",
  roulette: "Ruleta europea",
  jitter: "Jitterclick",
  reaction: "Reaction Test",
  precision: "Precision",
} as const;
export type Game = keyof typeof GAME_NAMES;
export type Skill = "jitter" | "reaction" | "precision";
export const MEDALS = ["Bronce", "Plata", "Oro", "Diamante"];
export const SKILLS = {
  jitter: {
    duration: 10,
    targets: [20, 35, 50, 65],
    unit: "clics",
    description: "Diez segundos. Cada clic cuenta.",
  },
  reaction: {
    duration: 0,
    targets: [450, 350, 250, 180],
    unit: "ms o menos",
    description: "Espera al verde. Confía en tus reflejos.",
  },
  precision: {
    duration: 20,
    targets: [8, 16, 25, 35],
    unit: "puntos",
    description: "Encuentra tu ritmo. Acierta cada objetivo.",
  },
} as const;
export const REPEAT_REWARDS = [20, 40, 65, 90];
export const FIRST_MEDAL_BONUS = 100;
export function skillTier(game: Skill, score: number): number {
  if (score <= 0 || !Number.isFinite(score)) return -1;
  let tier = -1;
  SKILLS[game].targets.forEach((target, i) => {
    if (game === "reaction" ? score <= target : score >= target) tier = i;
  });
  return tier;
}
export function skillReward(
  game: Skill,
  score: number,
  medals: number[],
): { reward: number; tier: number; unlocked: number[] } {
  const tier = skillTier(game, score);
  const unlocked = Array.from({ length: tier + 1 }, (_, i) => i).filter(
    (i) => !medals.includes(i),
  );
  return {
    tier,
    unlocked,
    reward: (REPEAT_REWARDS[tier] ?? 0) + unlocked.length * FIRST_MEDAL_BONUS,
  };
}
export const fmt = (n: number) =>
  new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 }).format(n);
export const levelFor = (xp: number) => Math.floor(xp / 250) + 1;
