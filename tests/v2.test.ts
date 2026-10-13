import { describe, it, expect } from "vitest";
import { resolveMode } from "../src/lib/v2/config";
import { AVATARS, profileSchema, signupSchema } from "../src/lib/v2/profile";
import { operationSchema } from "../src/lib/v2/schemas";
import { freshSave, transition, parseSave } from "../src/lib/engine";
import { clientState, serverTransition } from "../src/lib/v2/server-engine";
import { validateSkill, SkillProof } from "../src/lib/v2/skill-proof";
import { RUNNERS } from "../src/lib/racing";
describe("V2 mode and identity boundaries", () => {
  it("never enables demo in production, even with explicit demo flag", () => {
    expect(resolveMode({ nodeEnv: "production", demo: "true" })).toBe("local");
    expect(
      resolveMode({
        nodeEnv: "production",
        demo: "true",
        url: "url",
        key: "key",
      }),
    ).toBe("online");
    expect(resolveMode({ nodeEnv: "development", demo: "true" })).toBe("demo");
    expect(resolveMode({ nodeEnv: "development" })).toBe("local");
  });
  it("preserves six vehicles and exactly thirteen avatars", () => {
    expect(AVATARS).toHaveLength(13);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(13);
    expect(AVATARS.slice(0, 6).map((a) => [a.name, a.color])).toEqual(
      RUNNERS.map((r) => [r.name, r.color]),
    );
  });
  it("validates registration, safe profiles and rejects privileged properties", () => {
    const data = {
      username: "Player_123",
      email: "player@example.com",
      password: "StrongPass1234",
      confirm: "StrongPass1234",
    };
    expect(signupSchema.parse(data).username).toBe("player_123");
    for (const bad of [
      { email: "wrong" },
      { password: "weak" },
      { confirm: "Mismatch1234" },
      { username: "x" },
    ])
      expect(signupSchema.safeParse({ ...data, ...bad }).success).toBe(false);
    const edit = { username: "player", bio: "Mi club", avatar: "car-0" };
    expect(profileSchema.safeParse(edit).success).toBe(true);
    for (const bad of [
      { bio: "<script>" },
      { bio: "a".repeat(151) },
      { avatar: "https://example.com/a" },
      { original: true },
      { balance: 10000 },
    ])
      expect(profileSchema.safeParse({ ...edit, ...bad }).success).toBe(false);
  });
  it("accepts actions, never browser-supplied balances, results, or profiles", () => {
    const operationId = crypto.randomUUID();
    expect(
      operationSchema.safeParse({ operationId, action: { type: "daily" } })
        .success,
    ).toBe(true);
    for (const action of [
      { type: "daily", balance: 1e9 },
      { type: "roulette", result: 1, bets: [] },
      { type: "profile", name: "other" },
      { type: "blackjack", stake: -1 },
      { type: "settings", settings: { sensitivity: 4 } },
    ])
      expect(operationSchema.safeParse({ operationId, action }).success).toBe(
        false,
      );
  });
  it("redacts the live blackjack deck and hidden card without mutating private state", () => {
    const s = transition(freshSave(), { type: "blackjack", stake: 100 });
    const publicSave = clientState(s);
    if (
      publicSave.active?.game !== "blackjack" ||
      s.active?.game !== "blackjack"
    )
      throw new Error("round");
    expect(publicSave.active.hand.deck).toEqual([]);
    expect(publicSave.active.hand.dealer[1].rank).toBe(0);
    expect(s.active.hand.deck).toHaveLength(48);
    expect(s.active.hand.dealer[1].rank).toBeGreaterThan(0);
  });
});
describe("First action and server skill validation", () => {
  it("rejects corrupt saved sensitivity before rendering controls", () => {
    const s = freshSave();
    s.settings.sensitivity = 10;
    expect(() => parseSave(JSON.stringify(s))).toThrow();
  });
  it.each(["jitter", "precision"] as const)(
    "%s waits indefinitely until first action; repeat first action never resets time",
    (game) => {
      let s = transition(freshSave(), { type: "skill", game }, 100, "round");
      expect(() =>
        transition(s, { type: "skill-end", id: "round", score: 35 }, 100000),
      ).toThrow(/Haz clic/);
      s = transition(s, { type: "skill-first", id: "round" }, 100000);
      expect(s.active?.startedAt).toBe(100000);
      s = transition(s, { type: "skill-first", id: "round" }, 101000);
      expect(s.active?.startedAt).toBe(100000);
      expect(() =>
        transition(s, { type: "skill-end", id: "round", score: 35 }, 101000),
      ).toThrow(/aún/);
    },
  );
  it("persists bounded sensitivity without changing skill rules", () => {
    const s = transition(freshSave(), {
      type: "settings",
      settings: { sensitivity: 2.25 },
    });
    expect(s.settings.sensitivity).toBe(2.25);
    expect(() =>
      transition(s, { type: "settings", settings: { sensitivity: 0 } }),
    ).toThrow();
  });
  it("derives jitter count from evidence including first action, ignores forged claimed score", () => {
    let s = transition(freshSave(), { type: "skill", game: "jitter" }, 0);
    s = transition(s, { type: "skill-first", id: s.active!.id }, 100);
    const proof: SkillProof = {
      events: Array.from({ length: 35 }, (_, i) => ({
        t: i * 200 + (i % 2) * 13,
      })),
      width: 600,
      height: 335,
      touch: false,
      elapsed: 10000,
    };
    const result = serverTransition(
      s,
      { type: "skill-end", id: s.active!.id, score: 999999, proof },
      10100,
    );
    expect(result.status).toBe("verified");
    expect(result.state.stats.jitter.best).toBe(35);
    expect(result.state.balance).toBe(5240);
    expect(result.state.history[0].score).toBe(35);
  });
  it("quarantines impossible, automated or missing input evidence without payout", () => {
    let s = transition(freshSave(), { type: "skill", game: "jitter" }, 0);
    s = transition(s, { type: "skill-first", id: s.active!.id }, 0);
    const proof: SkillProof = {
      events: Array.from({ length: 65 }, (_, i) => ({ t: i * 1 })),
      width: 600,
      height: 335,
      touch: false,
      elapsed: 10000,
    };
    for (const evidence of [proof, undefined]) {
      const result = serverTransition(
        s,
        { type: "skill-end", id: s.active!.id, score: 65, proof: evidence },
        10000,
      );
      expect(result.status).toBe("flagged");
      expect(result.state.balance).toBe(5000);
      expect(result.state.stats.jitter.best).toBe(0);
      expect(result.state.history[0].label).toContain("revisión");
    }
  });
  it("replays precision hit/miss evidence against server targets", () => {
    let s = serverTransition(
      freshSave(),
      { type: "skill", game: "precision" },
      0,
    ).state;
    s = transition(s, { type: "skill-first", id: s.active!.id }, 0);
    if (s.active?.game !== "precision") throw new Error("round");
    s.active.targets = [
      { x: 50, y: 50 },
      { x: 25, y: 25 },
    ];
    const proof: SkillProof = {
      events: [
        { t: 0, x: 0.5, y: 0.5 },
        { t: 500, x: 0, y: 0 },
        { t: 900, x: 0.25, y: 0.25 },
      ],
      width: 600,
      height: 335,
      touch: false,
      elapsed: 20000,
    };
    expect(validateSkill(s.active, proof, 20000)).toEqual({
      score: 1,
      suspicious: false,
      reasons: [],
    });
  });
  it("rejects implausibly fast reaction and clock mismatch", () => {
    const s = transition(freshSave(), { type: "skill", game: "reaction" }, 0);
    if (s.active?.game !== "reaction") throw new Error("round");
    const proof: SkillProof = {
      events: [{ t: 20 }],
      width: 600,
      height: 335,
      touch: false,
      elapsed: 20,
    };
    expect(validateSkill(s.active, proof, s.active.delay + 20).suspicious).toBe(
      true,
    );
    proof.events = [{ t: 200 }];
    expect(
      validateSkill(s.active, proof, s.active.delay + 220).suspicious,
    ).toBe(false);
    expect(validateSkill(s.active, proof, 0).suspicious).toBe(true);
  });
});
