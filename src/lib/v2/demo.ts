import { freshSave, parseSave, Save } from "../engine";
import { Member, ProfileEdit, publicFromSave, RankingRow } from "./profile";
import { Ranking } from "./config";
export const DEMO_SESSION = "gambling:demo:v2:session";
const MEMBERS = "gambling:demo:v2:members";
export const demoSaveKey = (id: string) => `gambling:demo:v2:save:${id}`;
export function demoMembers(): Member[] {
  return JSON.parse(localStorage.getItem(MEMBERS) ?? "[]");
}
export function putMember(member: Member) {
  const list = demoMembers();
  localStorage.setItem(
    MEMBERS,
    JSON.stringify([...list.filter((p) => p.id !== member.id), member]),
  );
  window.dispatchEvent(new Event("demo-update"));
}
export function createDemo(username: string, original: boolean): Member {
  if (
    demoMembers().some(
      (m) => m.username.toLowerCase() === username.toLowerCase(),
    )
  )
    throw new Error("Ese nombre ya está usado en la DEMO.");
  const member: Member = {
    id: `demo-${crypto.randomUUID()}`,
    username,
    bio: "Perfil ficticio de desarrollo.",
    avatar: original ? "spade" : "car-1",
    original,
    joinedAt: new Date().toISOString(),
    balance: original ? 10000 : 5000,
    peak: original ? 10000 : 5000,
    xp: 0,
    played: 0,
    wins: 0,
    lost: 0,
    earned: 0,
    records: {},
    welcomePending: original,
  };
  const state = freshSave();
  state.name = username;
  state.balance = member.balance;
  state.peak = member.peak;
  state.granted = member.balance;
  if (original)
    state.ledger = [
      {
        id: `${member.id}-welcome`,
        at: Date.now(),
        amount: 5000,
        label: "DEMO · recompensa original",
      },
    ];
  localStorage.setItem(demoSaveKey(member.id), JSON.stringify(state));
  putMember(member);
  localStorage.setItem(DEMO_SESSION, member.id);
  return member;
}
export function editDemo(member: Member, edit: ProfileEdit) {
  if (
    demoMembers().some(
      (m) => m.id !== member.id && m.username === edit.username,
    )
  )
    throw new Error("Ese nombre ya está utilizado.");
  const next = { ...member, ...edit };
  const state = readDemo(member.id);
  state.name = edit.username;
  localStorage.setItem(demoSaveKey(member.id), JSON.stringify(state));
  putMember(next);
  return next;
}
export function readDemo(id: string): Save {
  return parseSave(
    localStorage.getItem(demoSaveKey(id)) ?? JSON.stringify(freshSave()),
  );
}
export function demoPlayers(): Member[] {
  const fixtures = Array.from({ length: 8 }, (_, i): Member => ({
    id: `demo-fixture-${i}`,
    username: `demo_${["goldrush", "neonghost", "redline", "mint", "bluecomet", "wildcard", "ace", "zero"][i]}`,
    bio: "Jugador ficticio. Datos de demostración.",
    avatar: i < 6 ? `car-${i}` : i === 6 ? "spade" : "roulette-green",
    original: i % 2 === 0,
    joinedAt: "2026-01-01T00:00:00Z",
    balance: 50000 - i * 4700,
    peak: 75000 - i * 5200,
    xp: 1800 - i * 150,
    played: 70 - i * 6,
    wins: 30 - i * 3,
    earned: 30000,
    lost: 12000,
    records: {
      blackjack: 1500 - i * 100,
      racing: 4500 - i * 200,
      roulette: 3500 - i * 200,
      jitter: 85 - i * 4,
      precision: 40 - i * 2,
      reaction: 160 + i * 15,
    },
    welcomePending: false,
  }));
  return [
    ...fixtures,
    ...demoMembers().map((m) => ({
      ...publicFromSave(m, readDemo(m.id)),
      welcomePending: m.welcomePending,
    })),
  ];
}
export function rankPlayers(players: Member[], kind: Ranking): RankingRow[] {
  return players
    .map((p) => ({
      ...p,
      value:
        kind === "balance"
          ? p.balance
          : kind === "peak"
            ? p.peak
            : (p.records[kind] ?? 0),
    }))
    .filter((p) => ["balance", "peak"].includes(kind) || p.value > 0)
    .sort(
      (a, b) =>
        (kind === "reaction" ? a.value - b.value : b.value - a.value) ||
        a.joinedAt.localeCompare(b.joinedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((p, i) => ({ ...p, position: i + 1 }));
}
