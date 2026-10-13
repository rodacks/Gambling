import { z } from "zod";
import { Game } from "../config";
import { RUNNERS } from "../racing";
import { Save } from "../engine";
export const AVATARS = [
  ...RUNNERS.map((r, i) => ({
    id: `car-${i}`,
    name: r.name,
    category: "Midnight Run",
    color: r.color,
  })),
  { id: "heart", name: "Corazón", category: "Blackjack", color: "#db6878" },
  { id: "club", name: "Trébol", category: "Blackjack", color: "#929fad" },
  { id: "diamond", name: "Diamante", category: "Blackjack", color: "#db6878" },
  { id: "spade", name: "Picas", category: "Blackjack", color: "#929fad" },
  { id: "roulette-red", name: "Rojo", category: "Ruleta", color: "#a94655" },
  { id: "roulette-black", name: "Negro", category: "Ruleta", color: "#555e6e" },
  { id: "roulette-green", name: "Verde", category: "Ruleta", color: "#439c7d" },
];
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "El nombre debe tener al menos 3 caracteres.")
  .max(20, "El máximo es 20 caracteres.")
  .regex(/^[a-zA-Z0-9_]+$/, "Usa letras sin tildes, números y guion bajo.")
  .transform((s) => s.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, "Usa al menos 12 caracteres.")
  .max(128, "El máximo es 128 caracteres.")
  .regex(/[a-z]/, "Añade una letra minúscula.")
  .regex(/[A-Z]/, "Añade una letra mayúscula.")
  .regex(/[0-9]/, "Añade un número.");
export const signupSchema = z
  .object({
    username: usernameSchema,
    email: z.email("Introduce un correo válido."),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });
export const profileSchema = z
  .object({
    username: usernameSchema,
    bio: z
      .string()
      .trim()
      .max(150, "La biografía admite hasta 150 caracteres.")
      .refine(
        (v) => !/[<>\u0000-\u0008]/.test(v),
        "La biografía debe ser texto simple.",
      ),
    avatar: z
      .string()
      .refine(
        (v) => AVATARS.some((a) => a.id === v),
        "Selecciona un avatar del club.",
      ),
  })
  .strict();
export type ProfileEdit = z.infer<typeof profileSchema>;
export type PublicPlayer = {
  id: string;
  username: string;
  bio: string;
  avatar: string;
  original: boolean;
  joinedAt: string;
  balance: number;
  peak: number;
  xp: number;
  played: number;
  wins: number;
  lost: number;
  earned: number;
  records: Partial<Record<Game, number>>;
};
export type Member = PublicPlayer & { welcomePending: boolean };
export type RankingRow = PublicPlayer & { position: number; value: number };
export function publicFromSave(
  member: PublicPlayer,
  state: Save,
): PublicPlayer {
  const records = { ...member.records };
  for (const [game, stat] of Object.entries(state.stats))
    records[game as Game] = ["blackjack", "roulette", "racing"].includes(game)
      ? (stat.bestNet ?? 0)
      : stat.best;
  return {
    ...member,
    username: state.name,
    balance: state.balance,
    peak: state.peak,
    xp: state.xp,
    played: Object.values(state.stats).reduce((a, s) => a + s.played, 0),
    wins: Object.values(state.stats).reduce((a, s) => a + s.wins, 0),
    lost: state.lost,
    earned: state.earned,
    records,
  };
}
