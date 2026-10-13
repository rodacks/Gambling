import { z } from "zod";
const id = z.uuid();
const stake = z
  .number()
  .positive()
  .max(90000000000000)
  .refine((n) => Math.round(n * 100) / 100 === n);
const proof = z
  .object({
    events: z
      .array(
        z
          .object({
            t: z.number().finite().min(0).max(60000),
            x: z.number().min(0).max(1).optional(),
            y: z.number().min(0).max(1).optional(),
          })
          .strict(),
      )
      .max(500),
    width: z.number().min(0).max(3000),
    height: z.number().min(0).max(2000),
    touch: z.boolean(),
    elapsed: z.number().min(0).max(60000),
  })
  .strict();
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }).strict(),
  z
    .object({
      type: z.literal("settings"),
      settings: z
        .object({
          sound: z.boolean().optional(),
          reducedMotion: z.boolean().optional(),
          sensitivity: z.number().min(0.25).max(3).optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("blackjack"), stake }).strict(),
  ...(["hit", "stand", "settle", "abandon", "skill-first"] as const).map(
    (type) => z.object({ type: z.literal(type), id }).strict(),
  ),
  z
    .object({
      type: z.literal("racing"),
      stake,
      selected: z.number().int().min(0).max(5),
    })
    .strict(),
  z
    .object({
      type: z.literal("roulette"),
      bets: z
        .array(
          z
            .object({
              kind: z.enum(["red", "black", "even", "odd", "number", "dozen"]),
              value: z.number().int().min(0).max(36).optional(),
              amount: stake,
            })
            .strict(),
        )
        .min(1)
        .max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("skill"),
      game: z.enum(["jitter", "reaction", "precision"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("skill-end"),
      id,
      score: z.number().int().min(0).max(10000),
      falseStart: z.boolean().optional(),
      proof: proof.optional(),
    })
    .strict(),
]);
export const operationSchema = z
  .object({ operationId: id, action: actionSchema })
  .strict();
