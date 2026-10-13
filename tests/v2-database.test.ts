import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Save, transition } from "../src/lib/engine";
let db: PGlite;
async function user(
  provider = "email",
  verified = false,
  name = "u_" + randomUUID().slice(0, 12).replaceAll("-", ""),
) {
  const id = randomUUID();
  await db.query<Record<string, unknown>>(
    `insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,$4)`,
    [id, { provider }, { username: name }, verified ? new Date() : null],
  );
  return id;
}
async function account(id: string) {
  return (
    await db.query<{ state: Save; revision: number }>(
      "select state,revision::int from game_accounts where user_id=$1",
      [id],
    )
  ).rows[0];
}
async function commit(
  id: string,
  op: string,
  revision: number,
  action: unknown,
  state: Save,
  result: unknown = null,
  status = "verified",
) {
  return (
    await db.query<{ result: { status: string; state: Save } }>(
      "select gambling_commit($1,$2,$3,$4,$5,$6,$7) as result",
      [id, op, revision, action, state, result, status],
    )
  ).rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610130001_gambling_v2.sql", "utf8"),
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("Real migration on embedded PostgreSQL", () => {
  it("grants original bonus only after verification, once; acknowledgment never pays", async () => {
    const id = await user();
    expect((await account(id)).state.balance).toBe(5000);
    await db.query<Record<string, unknown>>(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [id],
    );
    expect((await account(id)).state.balance).toBe(10000);
    await db.query<Record<string, unknown>>(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [id],
    );
    await db.query<Record<string, unknown>>("select gambling_acknowledge($1)", [
      id,
    ]);
    await db.query<Record<string, unknown>>("select gambling_acknowledge($1)", [
      id,
    ]);
    expect((await account(id)).state.balance).toBe(10000);
    const grant = (
      await db.query<Record<string, unknown>>(
        "select * from reward_grants where user_id=$1",
        [id],
      )
    ).rows;
    expect(grant).toHaveLength(1);
    expect(grant[0].acknowledged_at).toBeTruthy();
    await db.query<Record<string, unknown>>(
      `update auth.users set raw_app_meta_data='{"provider":"google"}',email_confirmed_at=now() where id=$1`,
      [id],
    );
    expect((await account(id)).state.balance).toBe(10000);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select original from player_profiles where user_id=$1",
          [id],
        )
      ).rows[0].original,
    ).toBe(true);
  });
  it("Google origins never become original by linking email or editing user metadata", async () => {
    const id = await user("google", true);
    expect((await account(id)).state.balance).toBe(5000);
    await db.query<Record<string, unknown>>(
      `update auth.users set raw_user_meta_data='{"provider":"email","original":true}',raw_app_meta_data='{"provider":"email"}',email_confirmed_at=now() where id=$1`,
      [id],
    );
    expect((await account(id)).state.balance).toBe(5000);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select original from player_profiles where user_id=$1",
          [id],
        )
      ).rows[0].original,
    ).toBe(false);
  });
  it("validates names, preserves stable public IDs and isolates private auth IDs", async () => {
    const id = await user("email", true, "unique_name");
    const before = (
      await db.query<Record<string, unknown>>(
        "select * from public_players where username=$1",
        ["unique_name"],
      )
    ).rows[0];
    expect(before.id).not.toBe(id);
    expect(before).not.toHaveProperty("user_id");
    expect(before).not.toHaveProperty("email");
    expect(before).not.toHaveProperty("state");
    await expect(user("email", false, "UNIQUE_NAME")).rejects.toThrow();
    await db.query<Record<string, unknown>>(
      "select gambling_edit_profile($1,$2,$3,$4)",
      [id, "edited_name", "Hola", "car-5"],
    );
    const after = (
      await db.query<Record<string, unknown>>(
        "select * from public_players where id=$1",
        [before.id],
      )
    ).rows[0];
    expect(after.username).toBe("edited_name");
    expect(after.avatar).toBe("car-5");
    expect((await account(id)).state.name).toBe("edited_name");
    await expect(
      db.query<Record<string, unknown>>(
        "select gambling_edit_profile($1,$2,$3,$4)",
        [id, "edited_name", "<script>", "car-5"],
      ),
    ).rejects.toThrow();
  });
  it("serializes competing revisions and makes operation retries idempotent", async () => {
    const id = await user("google", true);
    const a = await account(id);
    const action = { type: "racing" as const, stake: 500, selected: 0 };
    const next = transition(a.state, action);
    const op = randomUUID();
    const results = await Promise.all([
      commit(id, op, a.revision, action, next),
      commit(id, randomUUID(), a.revision, action, next),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "applied",
      "conflict",
    ]);
    expect((await account(id)).state.balance).toBe(4500);
    expect((await commit(id, op, 0, action, next)).status).toBe("duplicate");
    expect((await account(id)).state.balance).toBe(4500);
    await expect(commit(id, op, 0, { type: "daily" }, next)).rejects.toThrow(
      /reutilizado/,
    );
  });
  it("enforces 24 hours in SQL even if a faulty service proposes a duplicate grant", async () => {
    const id = await user("google", true);
    let a = await account(id);
    const action = { type: "daily" as const };
    let next = transition(a.state, action);
    await commit(id, randomUUID(), a.revision, action, next);
    a = await account(id);
    next = {
      ...a.state,
      balance: a.state.balance + 5000,
      peak: a.state.peak + 5000,
    };
    await expect(
      commit(id, randomUUID(), a.revision, action, next),
    ).rejects.toThrow(/diaria/);
    expect((await account(id)).state.balance).toBe(10000);
  });
  it("settles once, ranks casino net gains and excludes flagged skill records", async () => {
    const id = await user("google", true);
    let a = await account(id);
    let s = transition(a.state, { type: "racing", stake: 100, selected: 0 }, 0);
    if (s.active?.game === "racing") s.active.order = [0, 1, 2, 3, 4, 5];
    await commit(id, randomUUID(), a.revision, { type: "racing" }, s);
    a = await account(id);
    const action = { type: "settle" as const, id: s.active!.id };
    s = transition(s, action, 9000);
    const op = randomUUID();
    await commit(id, op, a.revision, action, s, s.history[0]);
    await commit(id, op, a.revision, action, s, s.history[0]);
    expect((await account(id)).state.balance).toBe(5220);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select value::int from personal_records where user_id=$1",
          [id],
        )
      ).rows[0].value,
    ).toBe(220);
    a = await account(id);
    s = transition(a.state, { type: "skill", game: "reaction" }, 0);
    await commit(id, randomUUID(), a.revision, { type: "skill" }, s);
    a = await account(id);
    s = transition(
      s,
      { type: "skill-end", id: s.active!.id, score: 150 },
      10000,
    );
    await commit(
      id,
      randomUUID(),
      a.revision,
      { type: "skill-end" },
      s,
      s.history[0],
      "flagged",
    );
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select * from personal_records where user_id=$1 and game='reaction'",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("reaction ranking chooses minimum time and separates rulesets", async () => {
    const ids = [await user("google", true), await user("google", true)];
    for (const [i, id] of ids.entries()) {
      for (const time of i === 0 ? [250, 180, 300] : [220]) {
        let a = await account(id);
        let s = transition(a.state, { type: "skill", game: "reaction" }, 0);
        await commit(id, randomUUID(), a.revision, { type: "skill" }, s);
        a = await account(id);
        s = transition(
          s,
          { type: "skill-end", id: s.active!.id, score: time },
          10000,
        );
        await commit(
          id,
          randomUUID(),
          a.revision,
          { type: "skill-end" },
          s,
          s.history[0],
        );
      }
    }
    const rows = (
      await db.query<Record<string, unknown>>(
        "select value::int from public_rankings where kind='reaction' order by position",
      )
    ).rows;
    expect(rows.map((r) => r.value)).toEqual([180, 220]);
  });
  it("RLS and grants deny direct balance, badge, origin, record, and RPC writes", async () => {
    await db.exec("set role authenticated");
    try {
      for (const sql of [
        "update game_accounts set revision=999",
        "update player_profiles set original=true",
        "insert into account_origins values(gen_random_uuid(),'email',now())",
        "delete from personal_records",
        "select gambling_original_grant(gen_random_uuid())",
        "select gambling_commit(gen_random_uuid(),gen_random_uuid(),0,'{}','{}')",
      ]) {
        await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
      }
      expect(
        (
          await db.query<Record<string, unknown>>(
            "select * from player_profiles",
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query<Record<string, unknown>>(
            "select * from public_players",
          )
        ).rows.length,
      ).toBeGreaterThan(0);
    } finally {
      await db.exec("reset role");
    }
  });
});
