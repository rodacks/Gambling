import {
  admin,
  failure,
  HttpError,
  rateLimit,
  readBody,
  requireUser,
  respond,
} from "@/lib/v2/server";
import { operationSchema } from "@/lib/v2/schemas";
import { clientState, serverTransition } from "@/lib/v2/server-engine";
import { Save } from "@/lib/engine";
import { SKILLS } from "@/lib/config";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireUser();
    const { data, error } = await admin()
      .from("game_accounts")
      .select("state")
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    return respond({ state: clientState(data.state as Save) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = operationSchema.parse(await readBody(request)),
      user = await requireUser();
    await rateLimit(user.id);
    const db = admin();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db
        .from("game_accounts")
        .select("state,revision")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      const current = data.state as Save;
      // Replay detection precedes transition; a repeated start must not reserve again.
      const { data: prior, error: priorError } = await db
        .from("game_operations")
        .select("action")
        .eq("user_id", user.id)
        .eq("operation_id", body.operationId)
        .maybeSingle();
      if (priorError) throw priorError;
      if (prior) {
        if (JSON.stringify(prior.action) !== JSON.stringify(body.action)) {
          // JSONB key order differs: let the database perform structural equality below.
          const { data: duplicate, error: dupError } = await db.rpc(
            "gambling_commit",
            {
              p_user: user.id,
              p_operation: body.operationId,
              p_revision: data.revision,
              p_action: body.action,
              p_state: current,
            },
          );
          if (dupError) throw dupError;
          return respond({ state: clientState(duplicate.state) });
        }
        return respond({ state: clientState(current) });
      }
      if (
        body.action.type === "skill-end" &&
        current.active &&
        ["jitter", "precision"].includes(current.active.game) &&
        !("prepared" in current.active && current.active.prepared)
      ) {
        const duration =
            SKILLS[current.active.game as "jitter" | "precision"].duration *
            1000,
          wait = current.active.startedAt + duration - Date.now();
        if (wait > 0 && wait <= 500)
          await new Promise((r) => setTimeout(r, wait));
      }
      let outcome;
      try {
        outcome = serverTransition(current, body.action, Date.now());
      } catch (e) {
        throw new HttpError((e as Error).message);
      }
      const { data: commit, error: commitError } = await db.rpc(
        "gambling_commit",
        {
          p_user: user.id,
          p_operation: body.operationId,
          p_revision: data.revision,
          p_action: body.action,
          p_state: outcome.state,
          p_result: outcome.result,
          p_status: outcome.status,
          p_evidence: outcome.evidence,
        },
      );
      if (commitError) throw commitError;
      if (commit.status !== "conflict")
        return respond({ state: clientState(commit.state) });
    }
    throw new HttpError(
      "Otra operación modificó tu partida. Actualiza e inténtalo otra vez.",
      409,
    );
  } catch (e) {
    return failure(e);
  }
}
