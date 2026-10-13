import { Round } from "../engine";
import { SKILLS, Skill } from "../config";
export type SkillEvent = { t: number; x?: number; y?: number };
export type SkillProof = {
  events: SkillEvent[];
  width: number;
  height: number;
  touch: boolean;
  elapsed: number;
};
export type Validation = {
  score: number;
  suspicious: boolean;
  reasons: string[];
};
/** Plausibility checks, not proof of human input. Suspect sessions are quarantined. */
export function validateSkill(
  round: Round,
  proof: SkillProof | undefined,
  now: number,
  falseStart = false,
): Validation {
  const reasons: string[] = [];
  let score = 0;
  if (!["jitter", "precision", "reaction"].includes(round.game) || !proof)
    return { score: 0, suspicious: true, reasons: ["missing_evidence"] };
  const game = round.game as Skill,
    events = proof.events;
  if (!events.length || events.length > 500)
    return { score: 0, suspicious: true, reasons: ["invalid_event_count"] };
  if (
    events.some(
      (e, i) =>
        !Number.isFinite(e.t) || e.t < 0 || (i > 0 && e.t <= events[i - 1].t),
    )
  )
    reasons.push("non_monotonic_events");
  if (
    !Number.isFinite(proof.elapsed) ||
    proof.elapsed < 0 ||
    proof.elapsed > 60000
  )
    reasons.push("invalid_elapsed");
  if (game === "reaction") {
    if (events.length !== 1) reasons.push("reaction_event_count");
    if (falseStart)
      return { score: 0, suspicious: reasons.length > 0, reasons };
    score = Math.round(events[0].t);
    const actual = now - round.startedAt - ("delay" in round ? round.delay : 0);
    if (score < 100 || score > 10000) reasons.push("implausible_reaction");
    if (actual < score - 100 || actual > score + 2000)
      reasons.push("reaction_clock_mismatch");
  } else {
    const duration = SKILLS[game].duration * 1000;
    if ("prepared" in round && round.prepared) reasons.push("not_started");
    if (events[0].t > 2) reasons.push("missing_first_action");
    if (events.some((e) => e.t >= duration))
      reasons.push("events_after_deadline");
    if (
      now - round.startedAt < duration - 500 ||
      now - round.startedAt > duration + 30000 ||
      Math.abs(proof.elapsed - duration) > 300
    )
      reasons.push("duration_mismatch");
    const intervals = events.slice(1).map((e, i) => e.t - events[i].t);
    if (intervals.some((d) => d < 15)) reasons.push("impossible_input_rate");
    if (intervals.length >= 20) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
      if (variance < 0.04) reasons.push("automated_cadence");
    }
    if (game === "jitter") {
      score = events.length;
      if (score > 200) reasons.push("extreme_click_score");
    } else {
      if (
        proof.width < 200 ||
        proof.width > 2400 ||
        proof.height < 200 ||
        proof.height > 1600
      )
        reasons.push("invalid_arena");
      let index = 0;
      const targets = "targets" in round ? round.targets : undefined;
      if (!targets?.length) reasons.push("missing_targets");
      for (const e of events) {
        const target = targets?.[index];
        if (
          !target ||
          e.x === undefined ||
          e.y === undefined ||
          !Number.isFinite(e.x) ||
          !Number.isFinite(e.y) ||
          e.x < 0 ||
          e.x > 1 ||
          e.y < 0 ||
          e.y > 1
        ) {
          reasons.push("invalid_shot");
          break;
        }
        const radius = Math.max(proof.touch ? 44 : 36, 64 - score * 0.8) / 2;
        const distance = Math.hypot(
          e.x * proof.width - (target.x / 100) * proof.width,
          e.y * proof.height - (target.y / 100) * proof.height,
        );
        if (distance <= radius + 1) {
          score++;
          index++;
        } else score = Math.max(0, score - 1);
      }
      if (score > 120) reasons.push("extreme_precision_score");
    }
  }
  return {
    score,
    suspicious: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}
