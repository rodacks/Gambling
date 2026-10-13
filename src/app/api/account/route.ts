import {
  admin,
  configured,
  failure,
  rateLimit,
  readBody,
  requireUser,
  respond,
  sessionClient,
} from "@/lib/v2/server";
import { profileSchema } from "@/lib/v2/profile";
import { z } from "zod";
export async function GET() {
  try {
    if (!configured())
      return respond(
        {
          error:
            "Configuración de Supabase pendiente: revisa las tres variables del servidor.",
        },
        503,
      );
    const client = await sessionClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return respond({ member: null });
    const db = admin();
    const { data: p, error } = await db
      .from("player_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    const { data: member, error: publicError } = await db
      .from("public_players")
      .select("*")
      .eq("id", p.id)
      .single();
    if (publicError) throw publicError;
    const { data: reward, error: rewardError } = await db
      .from("reward_grants")
      .select("acknowledged_at")
      .eq("user_id", user.id)
      .eq("kind", "original")
      .maybeSingle();
    if (rewardError) throw rewardError;
    return respond({
      member: {
        ...member,
        welcomePending: !!reward && !reward.acknowledged_at,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const edit = profileSchema.parse(await readBody(request)),
      user = await requireUser();
    await rateLimit(user.id, "profile", 15);
    const { error } = await admin().rpc("gambling_edit_profile", {
      p_user: user.id,
      p_username: edit.username,
      p_bio: edit.bio,
      p_avatar: edit.avatar,
    });
    if (error) throw error;
    return respond({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    z.object({ acknowledge: z.literal(true) })
      .strict()
      .parse(await readBody(request));
    const user = await requireUser();
    const { error } = await admin().rpc("gambling_acknowledge", {
      p_user: user.id,
    });
    if (error) throw error;
    return respond({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
