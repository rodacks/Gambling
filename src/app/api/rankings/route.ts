import { admin, failure, respond, sessionClient } from "@/lib/v2/server";
import { RANKINGS, Ranking } from "@/lib/v2/config";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      kind = (url.searchParams.get("kind") ?? "balance") as Ranking;
    if (!(kind in RANKINGS))
      return respond({ error: "Clasificación desconocida." }, 400);
    const page = Number(url.searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 4)
      return respond({ error: "Página inválida." }, 400);
    const db = admin();
    const { data: rows, error } = await db
      .from("public_rankings")
      .select("*")
      .eq("kind", kind)
      .order("position")
      .range(page * 20, page * 20 + 19);
    if (error) throw error;
    let me = null;
    const auth = await sessionClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (user) {
      const { data: p } = await db
        .from("player_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (p) {
        const { data: rank } = await db
          .from("public_rankings")
          .select("*")
          .eq("kind", kind)
          .eq("id", p.id)
          .maybeSingle();
        me = rank;
      }
    }
    return respond({ rows, me, hasMore: page < 4 && rows.length === 20 });
  } catch (e) {
    return failure(e);
  }
}
