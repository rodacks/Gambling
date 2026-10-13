export type AppMode = "local" | "demo" | "online";
export function resolveMode(env: {
  nodeEnv?: string;
  demo?: string;
  url?: string;
  key?: string;
}): AppMode {
  if (env.nodeEnv === "development" && env.demo === "true") return "demo";
  return env.url && env.key ? "online" : "local";
}
export const APP_MODE = resolveMode({
  nodeEnv: process.env.NODE_ENV,
  demo: process.env.NEXT_PUBLIC_DEMO_MODE,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
export const RANKINGS = {
  balance: "Top GAMBLINGS",
  peak: "Patrimonio histórico",
  blackjack: "Blackjack",
  racing: "Midnight Run",
  roulette: "Ruleta",
  jitter: "Jitterclick · 10 s",
  precision: "Precision · 20 s",
  reaction: "Reaction Test",
} as const;
export type Ranking = keyof typeof RANKINGS;
export const RULESETS = {
  blackjack: "blackjack-v1",
  racing: "racing-v1",
  roulette: "roulette-v1",
  jitter: "jitter-10s-v1",
  precision: "precision-20s-v1",
  reaction: "reaction-v1",
} as const;
